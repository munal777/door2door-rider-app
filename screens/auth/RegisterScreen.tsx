/**
 * Rider Registration Screen - Multi-Step Form
 * Step 1: Personal Information
 * Step 2: Emergency Contact & Vehicle Information
 * Step 3: Document Upload
 */

import React, { useState } from "react";
import {
  Image,
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { RiderRegistrationData, RiderDocument } from "@/types/api";

type Step = 1 | 2 | 3;

interface FormData {
  invitationToken: string;
  // Step 1
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  // Step 2
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleType: "bike" | "scooter" | "car" | "van";
  vehicleNumber: string;
  vehicleModel: string;
  vehicleColor: string;
  // Step 3
  drivingLicense?: { uri: string; name: string; type: string };
  drivingLicenseNumber: string;
  idProof?: { uri: string; name: string; type: string };
  idProofNumber: string;
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    invitationToken: "",
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    vehicleType: "bike",
    vehicleNumber: "",
    vehicleModel: "",
    vehicleColor: "",
    drivingLicenseNumber: "",
    idProofNumber: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.invitationToken.trim()) {
      newErrors.invitationToken = "Invitation token is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phoneNumber.replace(/\D/g, ""))) {
      newErrors.phoneNumber = "Please enter a valid 10-digit phone number";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = "Vehicle number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.drivingLicense) {
      newErrors.drivingLicense = "Driving license is required";
    }

    if (!formData.idProof) {
      newErrors.idProof = "ID proof is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = validateStep1();
    } else if (currentStep === 2) {
      isValid = validateStep2();
    }

    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => (prev - 1) as Step);
  };

  const pickDocument = async (type: "drivingLicense" | "idProof") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        updateField(type, {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/pdf",
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsLoading(true);

    const documents: RiderDocument[] = [];

    if (formData.drivingLicense) {
      documents.push({
        document_type: "rider_driving_license",
        document_number: formData.drivingLicenseNumber || undefined,
        uploaded_file: formData.drivingLicense,
      });
    }

    if (formData.idProof) {
      documents.push({
        document_type: "rider_id_proof",
        document_number: formData.idProofNumber || undefined,
        uploaded_file: formData.idProof,
      });
    }

    const registrationData: RiderRegistrationData = {
      invitation_token: formData.invitationToken.trim(),
      user: {
        email: formData.email.trim(),
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone_number: formData.phoneNumber.trim(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
      },
      date_of_birth: formData.dateOfBirth || undefined,
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      vehicle_type: formData.vehicleType,
      vehicle_number: formData.vehicleNumber.trim(),
      vehicle_model: formData.vehicleModel || undefined,
      vehicle_color: formData.vehicleColor || undefined,
      documents,
    };

    const result = await register(registrationData);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        "Registration Successful",
        "Your account is pending document verification. You will be notified once approved.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/auth/login" as any),
          },
        ],
      );
    } else {
      Alert.alert("Registration Failed", result.error || "An error occurred");
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.progressDot,
            currentStep >= step && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 3</Text>

      <Input
        label="Invitation Token"
        placeholder="Enter invitation token"
        value={formData.invitationToken}
        onChangeText={(text) => updateField("invitationToken", text)}
        error={errors.invitationToken}
      />

      <Input
        label="Email"
        placeholder="Enter your email"
        value={formData.email}
        onChangeText={(text) => updateField("email", text)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Input
            label="First Name"
            placeholder="First name"
            value={formData.firstName}
            onChangeText={(text) => updateField("firstName", text)}
            error={errors.firstName}
          />
        </View>
        <View style={styles.halfField}>
          <Input
            label="Last Name"
            placeholder="Last name"
            value={formData.lastName}
            onChangeText={(text) => updateField("lastName", text)}
            error={errors.lastName}
          />
        </View>
      </View>

      <Input
        label="Phone Number"
        placeholder="Enter phone number"
        value={formData.phoneNumber}
        onChangeText={(text) => updateField("phoneNumber", text)}
        keyboardType="phone-pad"
        error={errors.phoneNumber}
      />

      <Input
        label="Date of Birth (Optional)"
        placeholder="YYYY-MM-DD"
        value={formData.dateOfBirth}
        onChangeText={(text) => updateField("dateOfBirth", text)}
        error={errors.dateOfBirth}
      />

      <Input
        label="Password"
        placeholder="Enter password"
        value={formData.password}
        onChangeText={(text) => updateField("password", text)}
        secureTextEntry
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        placeholder="Re-enter password"
        value={formData.confirmPassword}
        onChangeText={(text) => updateField("confirmPassword", text)}
        secureTextEntry
        error={errors.confirmPassword}
      />

      <Button onPress={handleNext} style={styles.button}>
        Next
      </Button>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Emergency & Vehicle Info</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 3</Text>

      <Input
        label="Emergency Contact Name (Optional)"
        placeholder="Enter contact name"
        value={formData.emergencyContactName}
        onChangeText={(text) => updateField("emergencyContactName", text)}
      />

      <Input
        label="Emergency Contact Phone (Optional)"
        placeholder="Enter contact phone"
        value={formData.emergencyContactPhone}
        onChangeText={(text) => updateField("emergencyContactPhone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Vehicle Type</Text>
      <View style={styles.radioGroup}>
        {(["bike", "scooter", "car", "van"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.radioOption,
              formData.vehicleType === type && styles.radioOptionActive,
            ]}
            onPress={() => updateField("vehicleType", type)}
          >
            <Text
              style={[
                styles.radioText,
                formData.vehicleType === type && styles.radioTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label="Vehicle Number"
        placeholder="Enter vehicle number"
        value={formData.vehicleNumber}
        onChangeText={(text) => updateField("vehicleNumber", text)}
        autoCapitalize="characters"
        error={errors.vehicleNumber}
      />

      <Input
        label="Vehicle Model (Optional)"
        placeholder="Enter vehicle model"
        value={formData.vehicleModel}
        onChangeText={(text) => updateField("vehicleModel", text)}
      />

      <Input
        label="Vehicle Color (Optional)"
        placeholder="Enter vehicle color"
        value={formData.vehicleColor}
        onChangeText={(text) => updateField("vehicleColor", text)}
      />

      <View style={styles.buttonRow}>
        <Button
          variant="outline"
          onPress={handleBack}
          style={styles.halfButton}
        >
          Back
        </Button>
        <Button onPress={handleNext} style={styles.halfButton}>
          Next
        </Button>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Upload Documents</Text>
      <Text style={styles.stepSubtitle}>Step 3 of 3</Text>

      {/* Driving License */}
      <View style={styles.documentSection}>
        <Text style={styles.label}>Driving License *</Text>
        <Button
          variant="outline"
          onPress={() => pickDocument("drivingLicense")}
          style={styles.documentButton}
        >
          {formData.drivingLicense
            ? formData.drivingLicense.name
            : "Choose File"}
        </Button>
        {formData.drivingLicense && (
          <Text style={styles.fileSelected}>✓ File selected</Text>
        )}
        {errors.drivingLicense && (
          <Text style={styles.errorText}>{errors.drivingLicense}</Text>
        )}

        <Input
          label="License Number (Optional)"
          placeholder="Enter license number"
          value={formData.drivingLicenseNumber}
          onChangeText={(text) => updateField("drivingLicenseNumber", text)}
        />
      </View>

      {/* ID Proof */}
      <View style={styles.documentSection}>
        <Text style={styles.label}>ID Proof (Citizenship/Passport) *</Text>
        <Button
          variant="outline"
          onPress={() => pickDocument("idProof")}
          style={styles.documentButton}
        >
          {formData.idProof ? formData.idProof.name : "Choose File"}
        </Button>
        {formData.idProof && (
          <Text style={styles.fileSelected}>✓ File selected</Text>
        )}
        {errors.idProof && (
          <Text style={styles.errorText}>{errors.idProof}</Text>
        )}

        <Input
          label="ID Number (Optional)"
          placeholder="Enter ID number"
          value={formData.idProofNumber}
          onChangeText={(text) => updateField("idProofNumber", text)}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          variant="outline"
          onPress={handleBack}
          style={styles.halfButton}
        >
          Back
        </Button>
        <Button
          onPress={handleSubmit}
          isLoading={isLoading}
          style={styles.halfButton}
        >
          Submit
        </Button>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.brandLogo}
            />
          </View>
          <Text style={styles.title}>Rider Registration</Text>
          <Text style={styles.subtitle}>
            Create your account in three quick steps
          </Text>
          {renderProgressBar()}
        </View>

        <View style={styles.formCard}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/auth/login" as any)}>
            <Text style={styles.loginLink}>Login Here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.xxl * 1.2,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  brandLogo: {
    height: 48,
    width: 200,
    resizeMode: "contain",
  },
  title: {
    fontSize: FontSizes["2xl"],
    fontWeight: "800",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
    marginBottom: Spacing.md,
  },
  formCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  progressDot: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  stepContainer: {
    gap: Spacing.md,
  },
  stepTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
  },
  stepSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  radioOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  radioOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  radioTextActive: {
    color: "white",
    fontWeight: "600",
  },
  documentSection: {
    marginBottom: Spacing.md,
  },
  documentButton: {
    marginBottom: Spacing.xs,
  },
  fileSelected: {
    fontSize: FontSizes.sm,
    color: Colors.success,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  halfButton: {
    flex: 1,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  loginText: {
    fontSize: FontSizes.md,
    color: Colors.mutedForeground,
  },
  loginLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: "700",
  },
});

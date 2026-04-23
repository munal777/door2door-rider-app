/**
 * Forgot Password Screen - Multi-Step Password Reset
 * Step 1: Request OTP via Email
 * Step 2: Verify OTP
 * Step 3: Set New Password
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
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Colors, Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { authService } from "@/services/auth.service";

type Step = 1 | 2 | 3;

export default function ForgotPasswordScreen() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!otp.trim()) {
      newErrors.otp = "OTP is required";
    } else if (!/^\d{6}$/.test(otp)) {
      newErrors.otp = "OTP must be 6 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestOtp = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      const response = await authService.sendOTP({ email: email.trim() });

      if (response.IsSuccess) {
        Alert.alert(
          "OTP Sent",
          "Please check your email for the verification code.",
        );
        setCurrentStep(2);
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : "Failed to send OTP";
        Alert.alert("Error", errorMsg);
      }
    } catch (error: any) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const response = await authService.sendOTP({ email: email.trim() });

      if (response.IsSuccess) {
        Alert.alert("OTP Resent", "A new verification code has been sent.");
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : "Failed to resend OTP";
        Alert.alert("Error", errorMsg);
      }
    } catch (error: any) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateOtp()) return;

    setIsLoading(true);
    try {
      const response = await authService.validateOTP({
        email: email.trim(),
        otp: otp.trim(),
      });

      if (response.IsSuccess) {
        Alert.alert("OTP Verified", "Please enter your new password.");
        setCurrentStep(3);
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : "Invalid or expired OTP";
        Alert.alert("Error", errorMsg);
      }
    } catch (error: any) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;

    setIsLoading(true);
    try {
      const response = await authService.changePassword({
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });

      if (response.IsSuccess) {
        Alert.alert(
          "Password Reset Successful",
          "You can now login with your new password.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/auth/login" as any),
            },
          ],
        );
      } else {
        const errorMsg = Array.isArray(response.ErrorMessage)
          ? response.ErrorMessage.join(", ")
          : "Failed to reset password";
        Alert.alert("Error", errorMsg);
      }
    } catch (error: any) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
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
      <Text style={styles.stepTitle}>Enter Your Email</Text>
      <Text style={styles.stepSubtitle}>
        We'll send you a verification code to reset your password.
      </Text>

      <Input
        label="Email"
        placeholder="Enter your email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errors.email) {
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.email;
              return newErrors;
            });
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />

      <Button onPress={handleRequestOtp} isLoading={isLoading}>
        Send Verification Code
      </Button>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verify OTP</Text>
      <Text style={styles.stepSubtitle}>
        Enter the 6-digit code sent to {email}
      </Text>

      <Input
        label="Verification Code"
        placeholder="Enter 6-digit code"
        value={otp}
        onChangeText={(text) => {
          setOtp(text);
          if (errors.otp) {
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.otp;
              return newErrors;
            });
          }
        }}
        keyboardType="number-pad"
        maxLength={6}
        error={errors.otp}
      />

      <Button onPress={handleVerifyOtp} isLoading={isLoading}>
        Verify Code
      </Button>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
          <Text style={styles.resendLink}>Resend</Text>
        </TouchableOpacity>
      </View>

      <Button variant="outline" onPress={() => setCurrentStep(1)}>
        Change Email
      </Button>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set New Password</Text>
      <Text style={styles.stepSubtitle}>
        Create a strong password for your account.
      </Text>

      <Input
        label="New Password"
        placeholder="Enter new password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) {
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.password;
              return newErrors;
            });
          }
        }}
        secureTextEntry
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        placeholder="Re-enter new password"
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          if (errors.confirmPassword) {
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.confirmPassword;
              return newErrors;
            });
          }
        }}
        secureTextEntry
        error={errors.confirmPassword}
      />

      <Button onPress={handleResetPassword} isLoading={isLoading}>
        Reset Password
      </Button>
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
          <Text style={styles.title}>Reset Password</Text>
          {renderProgressBar()}
        </View>

        <View style={styles.formCard}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Remember your password? </Text>
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
    fontWeight: "600",
    color: Colors.text,
  },
  stepSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
    marginBottom: Spacing.sm,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  resendText: {
    fontSize: FontSizes.sm,
    color: Colors.mutedForeground,
  },
  resendLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: "600",
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

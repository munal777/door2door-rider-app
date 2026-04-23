import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { router } from "expo-router";
import { Lock, Mail } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BorderRadius, Colors, FontSizes, Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    const result = await login(email.trim(), password);
    setIsLoading(false);

    if (!result.success) {
      Alert.alert("Login Failed", result.error || "An error occurred");
    }
    // Navigation is handled automatically by the auth context
  };

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
          <Text style={styles.title}>Rider Sign In</Text>
          <Text style={styles.subtitle}>
            Continue to your delivery workspace
          </Text>
        </View>

        <View style={styles.card}>
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            leftIcon={
              <Mail size={16} color={Colors.mutedForeground} strokeWidth={2} />
            }
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password)
                setErrors({ ...errors, password: undefined });
            }}
            isPassword
            error={errors.password}
            leftIcon={
              <Lock size={16} color={Colors.mutedForeground} strokeWidth={2} />
            }
          />

          <TouchableOpacity
            onPress={() => router.push("/auth/forgot-password" as any)}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            fullWidth
            size="lg"
            style={styles.loginButton}
          />
        </View>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => router.push("/auth/register" as any)}
          >
            <Text style={styles.registerLink}>Register Here</Text>
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
    paddingTop: Spacing.xxl * 1.35,
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
    fontSize: FontSizes.md,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  card: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  forgotPasswordText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: "600",
  },
  loginButton: {
    marginTop: Spacing.md,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  registerText: {
    fontSize: FontSizes.md,
    color: Colors.mutedForeground,
  },
  registerLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: "700",
  },
});

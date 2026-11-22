import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { MobileApiClient } from '../api/mobileClient';
import { saveToken, saveServerUrl, saveUsername } from '../storage/authStorage';
import { useTheme } from '../context/ThemeContext';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [serverUrl, setServerUrlState] = useState('https://yoursite.runasp.net');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');

  // Sign In inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Reset Password inputs
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please fill in server URL, username/email, and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await MobileApiClient.login(serverUrl.trim(), username.trim(), password.trim());
      await saveServerUrl(serverUrl.trim());
      await saveToken(res.token);
      await saveUsername(res.username);
      onLoginSuccess();
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    if (!serverUrl.trim() || !resetEmail.trim()) {
      Alert.alert('Required', 'Please fill in server URL and registered email.');
      return;
    }

    try {
      setLoading(true);
      const res = await MobileApiClient.forgotPassword(serverUrl.trim(), resetEmail.trim());
      Alert.alert('Reset Code Sent', res.message || 'Check your email for the 6-digit verification code.');
      if (res.devCode) {
        setResetCode(res.devCode);
      }
      setResetStep('verify');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetCode.trim() || !newPassword || !confirmNewPassword) {
      Alert.alert('Required', 'Please fill in the 6-digit code and new passwords.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await MobileApiClient.resetPassword(serverUrl.trim(), resetEmail.trim(), resetCode.trim(), newPassword);
      Alert.alert('Success', 'Password reset successfully! You can now sign in.');
      setUsername(resetEmail.trim());
      setPassword(newPassword);
      setIsForgotMode(false);
      setResetStep('request');
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Invalid or expired reset code');
    } finally {
      setLoading(false);
    }
  };

  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.appName, { color: colors.text }]}>NoteBook</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {isForgotMode ? 'Account Recovery' : 'Connect to your MonsterASP host'}
        </Text>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Server URL</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={serverUrl}
            onChangeText={setServerUrlState}
            placeholder="https://yoursite.runasp.net"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        {!isForgotMode ? (
          <>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Username or Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Username or email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                <TouchableOpacity onPress={() => setIsForgotMode(true)}>
                  <Text style={[styles.forgotLink, { color: colors.primary }]}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.buttonBg }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.buttonText }]}>Sign In</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {resetStep === 'request' ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Registered Email</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.buttonBg }]}
                  onPress={handleRequestReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.buttonText }]}>Send 6-Digit Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>6-Digit Verification Code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={resetCode}
                    onChangeText={(val) => setResetCode(val.replace(/\D/g, ''))}
                    placeholder="123456"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>New Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm New Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.buttonBg }]}
                  onPress={handleConfirmReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.buttonText }]}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setIsForgotMode(false);
                setResetStep('request');
              }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fafaf9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1917',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#44403c',
    marginBottom: 6,
  },
  forgotLink: {
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1c1917',
    backgroundColor: '#fafaf9',
  },
  codeInput: {
    fontSize: 18,
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

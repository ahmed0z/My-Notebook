import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { MobileApiClient } from '../api/mobileClient';
import { getUsername } from '../storage/authStorage';

export interface SettingsScreenProps {
  onBack: () => void;
  onToggleSideMenu?: () => void;
  currentUsername?: string;
}

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '📱' },
];

const VIEW_OPTIONS: { value: 'compact' | 'fullscreen'; label: string; icon: string }[] = [
  { value: 'compact', label: 'Compact', icon: '🗗' },
  { value: 'fullscreen', label: 'Full Screen', icon: '⛶' },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onToggleSideMenu,
  currentUsername,
}) => {
  const { colors, isDark, theme = 'system', setTheme } = useTheme();
  const { defaultView = 'compact', setDefaultView } = useSettings();

  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(currentUsername ?? null);

  useEffect(() => {
    if (!currentUsername) {
      getUsername().then(u => {
        if (u) setLoggedInUsername(u);
      }).catch(() => {});
    }
  }, [currentUsername]);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add User state
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userMessage, setUserMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'All password fields are required.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setPasswordLoading(true);
      await MobileApiClient.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setUserMessage(null);
    if (!newUsername.trim() || !newUserPassword) {
      setUserMessage({ type: 'error', text: 'Username and password are required.' });
      return;
    }

    try {
      setUserLoading(true);
      await MobileApiClient.createUser(newUsername.trim(), newUserPassword);
      const createdName = newUsername.trim();
      setNewUsername('');
      setNewUserPassword('');
      setUserMessage({ type: 'success', text: `User "${createdName}" created successfully.` });
    } catch (err: any) {
      setUserMessage({ type: 'error', text: err.message || 'Failed to create user.' });
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onToggleSideMenu && (
            <TouchableOpacity
              onPress={onToggleSideMenu}
              style={styles.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open menu"
            >
              <Text style={[styles.headerBtnText, { color: colors.text }]}>☰</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onBack}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back to notes"
          >
            <Text style={[styles.headerBtnText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Appearance Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎨</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Appearance
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Color themes & display options
              </Text>
            </View>
          </View>
          <View style={styles.themeOptionsContainer}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>
              Theme
            </Text>
            <View
              style={[
                styles.themeSegmentedControl,
                {
                  backgroundColor: isDark ? '#292524' : '#f5f5f4',
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="radiogroup"
            >
              {THEME_OPTIONS.map((option) => {
                const isSelected = theme === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${option.label} theme`}
                    testID={`theme-option-${option.value}`}
                    onPress={() => setTheme?.(option.value)}
                    style={[
                      styles.themeOptionButton,
                      isSelected && [
                        styles.themeOptionButtonActive,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ],
                    ]}
                  >
                    <Text style={styles.themeOptionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.themeOptionText,
                        {
                          color: isSelected ? colors.text : colors.textMuted,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* View Preferences Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📐</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                View Preferences
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Default opening mode and layout
              </Text>
            </View>
          </View>
          <View style={styles.themeOptionsContainer}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>
              Default View
            </Text>
            <View
              style={[
                styles.themeSegmentedControl,
                {
                  backgroundColor: isDark ? '#292524' : '#f5f5f4',
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="radiogroup"
            >
              {VIEW_OPTIONS.map((option) => {
                const isSelected = defaultView === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${option.label} view`}
                    testID={`view-option-${option.value}`}
                    onPress={() => setDefaultView?.(option.value)}
                    style={[
                      styles.themeOptionButton,
                      isSelected && [
                        styles.themeOptionButtonActive,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ],
                    ]}
                  >
                    <Text style={styles.themeOptionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.themeOptionText,
                        {
                          color: isSelected ? colors.text : colors.textMuted,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>👤</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Account & Security
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Manage your credentials and users
              </Text>
            </View>
          </View>

          {/* Current user */}
          <View
            style={[
              styles.currentUserBox,
              {
                backgroundColor: isDark ? '#292524' : '#f5f5f4',
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.currentUserLabel, { color: colors.textMuted }]}>
              Current user:
            </Text>
            <Text
              testID="current-username"
              style={[styles.currentUsernameText, { color: colors.text }]}
            >
              {loggedInUsername || currentUsername || 'Anonymous'}
            </Text>
          </View>

          {/* Change Password Form */}
          <View style={[styles.subSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>
              🔑 Change Password
            </Text>
            <Text style={[styles.sessionAdvisoryText, { color: colors.textMuted }]}>
              Note: Changing your password will not immediately disconnect other active browser or mobile sessions until token expiration.
            </Text>

            {passwordMessage && (
              <Text
                testID="password-message"
                style={[
                  styles.msgText,
                  passwordMessage.type === 'success' ? styles.successMsg : styles.errorMsg,
                ]}
              >
                {passwordMessage.text}
              </Text>
            )}

            <TextInput
              testID="current-password-input"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              testID="new-password-input"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              testID="confirm-password-input"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              testID="change-password-submit"
              disabled={passwordLoading}
              onPress={handleChangePassword}
              style={[styles.submitBtn, { backgroundColor: isDark ? '#f5f5f4' : '#1c1917' }]}
            >
              <Text style={[styles.submitBtnText, { color: isDark ? '#1c1917' : '#ffffff' }]}>
                {passwordLoading ? 'Updating...' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add New User Form */}
          <View style={[styles.subSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>
              ➕ Add New User
            </Text>

            {userMessage && (
              <Text
                testID="user-message"
                style={[
                  styles.msgText,
                  userMessage.type === 'success' ? styles.successMsg : styles.errorMsg,
                ]}
              >
                {userMessage.text}
              </Text>
            )}

            <TextInput
              testID="new-user-username-input"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}
              placeholder="New username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={newUsername}
              onChangeText={setNewUsername}
            />
            <TextInput
              testID="new-user-password-input"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1917' : '#ffffff' }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newUserPassword}
              onChangeText={setNewUserPassword}
            />

            <TouchableOpacity
              testID="create-user-submit"
              disabled={userLoading}
              onPress={handleCreateUser}
              style={[styles.submitBtn, { backgroundColor: isDark ? '#f5f5f4' : '#1c1917' }]}
            >
              <Text style={[styles.submitBtnText, { color: isDark ? '#1c1917' : '#ffffff' }]}>
                {userLoading ? 'Creating...' : 'Add User'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
  },
  headerBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 24,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  placeholderBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
  },
  placeholderText: {
    fontSize: 13,
    lineHeight: 18,
  },
  themeOptionsContainer: {
    marginTop: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  themeSegmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  themeOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  themeOptionButtonActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themeOptionIcon: {
    fontSize: 15,
  },
  themeOptionText: {
    fontSize: 13,
  },
  currentUserBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  currentUserLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  currentUsernameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sessionAdvisoryText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  msgText: {
    fontSize: 12,
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  successMsg: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
  },
  errorMsg: {
    backgroundColor: '#fff1f2',
    color: '#9f1239',
  },
});

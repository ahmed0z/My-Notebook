import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { SpaceDto } from '@notebook/shared';
import { useTheme } from '../context/ThemeContext';
import { MobileSpaceSelector } from './MobileSpaceSelector';

export interface MobileSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: 'notes' | 'archive' | 'settings') => void;
  currentScreen: 'notes' | 'archive' | 'settings';
  spaces?: SpaceDto[];
  activeSpaceId?: string | null;
  onSelectSpace?: (spaceId: string | null) => void;
  onCreateSpace?: (name: string, parentSpaceId?: string | null) => Promise<void>;
  onUpdateSpace?: (id: string, updates: { name?: string; parentSpaceId?: string | null }) => Promise<void>;
  onDeleteSpace?: (id: string) => Promise<void>;
}

interface NavItem {
  id: 'notes' | 'archive' | 'settings';
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'archive', label: 'Archive', icon: '📦' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const MobileSideMenu: React.FC<MobileSideMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentScreen,
  spaces = [],
  activeSpaceId = null,
  onSelectSpace,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
}) => {
  const { isDark, colors } = useTheme();

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close menu backdrop"
        />

        {/* Drawer content */}
        <View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>NoteBook</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close menu"
            >
              <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Items */}
          <View style={styles.navContainer}>
            {NAV_ITEMS.map((item) => {
              const isActive = currentScreen === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.navItem,
                    isActive && {
                      backgroundColor: isDark ? '#292524' : '#e7e5e4',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  accessibilityLabel={item.label}
                >
                  <Text style={styles.navIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.navText,
                      {
                        color: isActive ? colors.text : colors.textSecondary,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Spaces section */}
            {onSelectSpace && (
              <View style={[styles.spacesSection, { borderTopColor: colors.border }]}>
                <MobileSpaceSelector
                  spaces={spaces}
                  activeSpaceId={activeSpaceId}
                  onSelectSpace={(spaceId) => {
                    onSelectSpace(spaceId);
                    onNavigate('notes');
                    onClose();
                  }}
                  onCreateSpace={onCreateSpace || (async () => {})}
                  onUpdateSpace={onUpdateSpace}
                  onDeleteSpace={onDeleteSpace}
                />
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              NoteBook Mobile
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawer: {
    width: Math.min(Dimensions.get('window').width * 0.75, 280),
    height: '100%',
    borderRightWidth: 1,
    paddingTop: 50,
    paddingBottom: 24,
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  navContainer: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 6,
  },
  spacesSection: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 12,
  },
  navIcon: {
    fontSize: 18,
  },
  navText: {
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
  },
});

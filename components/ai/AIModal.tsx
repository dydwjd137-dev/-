/**
 * AIModal.tsx
 * Fancy full-screen slide-up modal base for AI analysis screens.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_H = SCREEN_H * 0.88;

const PURPLE = '#6B4FFF';
const BG     = '#0D0B1A';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  accentColor?: string;
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  noScroll?: boolean;
}

export default function AIModal({
  visible,
  onClose,
  title,
  icon,
  accentColor = PURPLE,
  children,
  loading,
  loadingText = '분析 중…',
  noScroll = false,
}: Props) {
  const slideAnim    = useRef(new Animated.Value(PANEL_H)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const [progressPct, setProgressPct] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: PANEL_H,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Progress simulation
  useEffect(() => {
    if (loading) {
      setProgressPct(0);
      // Curve: fast to 60%, slow to 90%, stops until done
      const targets = [
        { target: 30, step: 3,   interval: 200  },
        { target: 60, step: 2,   interval: 400  },
        { target: 80, step: 1,   interval: 800  },
        { target: 90, step: 0.5, interval: 1500 },
      ];
      let current = 0;
      let phaseIdx = 0;

      const tick = () => {
        if (phaseIdx >= targets.length) return;
        const { target, step, interval } = targets[phaseIdx];
        current = Math.min(current + step, target);
        setProgressPct(Math.round(current));
        if (current >= target) phaseIdx++;
        timerRef.current = setTimeout(tick, interval);
      };
      timerRef.current = setTimeout(tick, 100);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressPct > 0) {
        // Snap to 100% when done
        setProgressPct(100);
        setTimeout(() => setProgressPct(0), 800);
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: `${accentColor}30` }]}>
          {/* Glow accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          <View style={styles.headerContent}>
            {/* Icon circle */}
            <View style={[styles.iconCircle, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}>
              <Ionicons name={icon as any} size={20} color={accentColor} />
            </View>

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={[styles.headerSubtitle, { color: accentColor }]}>AI 분석 결과</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.07)' }]} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={[styles.progressPct, { color: accentColor }]}>
              {progressPct}%
            </Text>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: accentColor,
                    width: `${progressPct}%` as any,
                  },
                ]}
              />
            </View>
            <Text style={[styles.loadingText, { color: `${accentColor}CC` }]}>
              {loadingText}
            </Text>
            <Text style={styles.loadingHint}>AI가 포트폴리오 데이터를 분석하고 있어요</Text>
          </View>
        ) : noScroll ? (
          <View style={styles.scroll}>{children}</View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 3, 15, 0.82)',
  },

  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_H,
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -8px 40px rgba(107,79,255,0.25)' }
      : {
          shadowColor: '#6B4FFF',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 24,
        }),
  },

  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  header: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  accentBar: {
    height: 2,
    opacity: 0.7,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as any,
  },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
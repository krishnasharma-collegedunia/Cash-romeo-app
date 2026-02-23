import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { C, F } from '../constants/theme';

const { width } = Dimensions.get('window');
const AD_DURATION = 3; // seconds

export default function MockAdOverlay({ visible, onAdComplete }) {
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const countRef = useRef(AD_DURATION);
  const [remaining, setRemaining] = React.useState(AD_DURATION);
  const animRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Reset state
      countRef.current = AD_DURATION;
      setRemaining(AD_DURATION);
      progress.setValue(0);

      // Animate progress bar
      animRef.current = Animated.timing(progress, {
        toValue: 1,
        duration: AD_DURATION * 1000,
        useNativeDriver: false,
      });
      animRef.current.start();

      // Countdown tick
      timerRef.current = setInterval(() => {
        countRef.current -= 1;
        setRemaining(countRef.current);
        if (countRef.current <= 0) {
          clearInterval(timerRef.current);
          onAdComplete && onAdComplete();
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) animRef.current.stop();
    };
  }, [visible]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.7],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Ad Playing...</Text>
          <Text style={styles.subtitle}>{remaining} second{remaining !== 1 ? 's' : ''} remaining</Text>

          <View style={styles.barBg}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
          </View>

          <Text style={styles.note}>Please wait for the ad to finish</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: C.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: C.muted,
    marginBottom: 32,
    textAlign: 'center',
  },
  barBg: {
    width: '70%',
    height: 6,
    backgroundColor: C.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: C.primary,
    borderRadius: 3,
  },
  note: {
    marginTop: 20,
    fontSize: 13,
    color: C.disabled,
    textAlign: 'center',
  },
});

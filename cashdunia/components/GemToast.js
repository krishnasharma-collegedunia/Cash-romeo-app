import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Dimensions } from 'react-native';
import { C, F } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function GemToast({ visible, message = '+1 Gem Earned!', onDone }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(0);
    opacity.setValue(0);

    animRef.current = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
      ]),
    ]);

    animRef.current.start(() => {
      onDone && onDone();
    });

    return () => {
      if (animRef.current) animRef.current.stop();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>💎 {message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    backgroundColor: '#00C85322',
    borderWidth: 1,
    borderColor: '#00C853',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 1000,
  },
  text: {
    color: '#00C853',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { C } from '../constants/theme';

export default function SkeletonBox({ width = '100%', height = 20, borderRadius = 8, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    animRef.current.start();

    return () => {
      if (animRef.current) animRef.current.stop();
    };
  }, []);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [C.surface, C.border],
  });

  return (
    <Animated.View
      style={[
        styles.box,
        { width, height, borderRadius, backgroundColor },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
});

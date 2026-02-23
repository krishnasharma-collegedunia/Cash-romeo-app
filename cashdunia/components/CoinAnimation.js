import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const NUM_COINS = 8;

const getAngle = (index) => (index / NUM_COINS) * Math.PI * 2;

export default function CoinAnimation({ visible, onDone }) {
  const coins = useRef(
    Array.from({ length: NUM_COINS }, () => ({
      anim: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    const animations = coins.map(({ anim, opacity }) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.parallel(animations).start(() => {
      coins.forEach(({ anim, opacity }) => {
        anim.setValue(0);
        opacity.setValue(1);
      });
      onDone && onDone();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {coins.map(({ anim, opacity }, i) => {
        const angle = getAngle(i);
        const radius = 80;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;

        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, tx],
        });
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, ty],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.5, 1.3, 0.8],
        });

        return (
          <Animated.Text
            key={i}
            style={[
              styles.coin,
              { opacity, transform: [{ translateX }, { translateY }, { scale }] },
            ]}
          >
            🪙
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  coin: {
    position: 'absolute',
    fontSize: 28,
  },
});

import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CYAN = "#00C8FF";
const YELLOW = "#F5C100";
const BORDER_W = 2.5;
const LIGHT_LEN = 90;
const STORAGE_KEY = "neon_frame_v1";
const ANIM_DURATION = 5000;

export function NeonFrame({ children }: { children: React.ReactNode }) {
  const dims = Dimensions.get("window");
  const W = dims.width;
  const H = dims.height;
  const perimeter = 2 * (W + H);

  const [animating, setAnimating] = useState(false);
  const dashOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (!val) {
        setAnimating(true);
        dashOffset.setValue(0);
        Animated.timing(dashOffset, {
          toValue: -(perimeter * 2),
          duration: ANIM_DURATION,
          useNativeDriver: false,
        }).start(() => {
          AsyncStorage.setItem(STORAGE_KEY, "1");
          setAnimating(false);
        });
      }
    });
  }, []);

  const gap = perimeter - LIGHT_LEN;
  const gapOuter = perimeter - LIGHT_LEN * 2.5;

  return (
    <View style={styles.container}>
      {children}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient
              id="borderGrad"
              x1="0"
              y1="0"
              x2={W}
              y2={H}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={CYAN} stopOpacity="0.9" />
              <Stop offset="38%" stopColor={CYAN} stopOpacity="0.28" />
              <Stop offset="62%" stopColor={YELLOW} stopOpacity="0.28" />
              <Stop offset="100%" stopColor={YELLOW} stopOpacity="0.9" />
            </LinearGradient>

            <LinearGradient
              id="glowGrad"
              x1="0"
              y1="0"
              x2={W}
              y2={H}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={CYAN} stopOpacity="1" />
              <Stop offset="40%" stopColor="#88EAFF" stopOpacity="0.9" />
              <Stop offset="60%" stopColor="#FFE566" stopOpacity="0.9" />
              <Stop offset="100%" stopColor={YELLOW} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Static gradient border — always visible */}
          <Rect
            x={BORDER_W / 2}
            y={BORDER_W / 2}
            width={W - BORDER_W}
            height={H - BORDER_W}
            fill="none"
            stroke="url(#borderGrad)"
            strokeWidth={BORDER_W}
          />

          {/* Outer wide glow that travels around (first open only) */}
          {animating && (
            <AnimatedRect
              x={BORDER_W / 2}
              y={BORDER_W / 2}
              width={W - BORDER_W}
              height={H - BORDER_W}
              fill="none"
              stroke="url(#glowGrad)"
              strokeWidth={BORDER_W + 8}
              strokeDasharray={`${LIGHT_LEN * 2.5} ${gapOuter}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeOpacity="0.35"
            />
          )}

          {/* Bright core light that travels around (first open only) */}
          {animating && (
            <AnimatedRect
              x={BORDER_W / 2}
              y={BORDER_W / 2}
              width={W - BORDER_W}
              height={H - BORDER_W}
              fill="none"
              stroke="#ffffff"
              strokeWidth={BORDER_W + 1.5}
              strokeDasharray={`${LIGHT_LEN} ${gap}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeOpacity="0.95"
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

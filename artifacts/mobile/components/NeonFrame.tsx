import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
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
  const { width: W, height: H } = useWindowDimensions();
  const perimeter = 2 * (W + H);

  const [animating, setAnimating] = useState(false);
  const dashOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!W || !H) return;
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (!val) {
        setAnimating(true);
        dashOffset.setValue(0);
        Animated.timing(dashOffset, {
          toValue: -(perimeter * 2),
          duration: ANIM_DURATION,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            AsyncStorage.setItem(STORAGE_KEY, "1");
            setAnimating(false);
          }
        });
      }
    });
  }, [W, H]);

  if (!W || !H) {
    return <View style={styles.container}>{children}</View>;
  }

  const gap = Math.max(1, perimeter - LIGHT_LEN);
  const gapOuter = Math.max(1, perimeter - LIGHT_LEN * 2.5);
  const bx = BORDER_W / 2;
  const rectW = W - BORDER_W;
  const rectH = H - BORDER_W;

  return (
    <View style={styles.container}>
      {children}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg
          width={W}
          height={H}
          style={StyleSheet.absoluteFillObject}
        >
          <Defs>
            <LinearGradient
              id="nfBorderGrad"
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
              id="nfGlowGrad"
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
            x={bx}
            y={bx}
            width={rectW}
            height={rectH}
            fill="none"
            stroke="url(#nfBorderGrad)"
            strokeWidth={BORDER_W}
          />

          {/* Wide gradient glow chasing around — first open only */}
          {animating && (
            <AnimatedRect
              x={bx}
              y={bx}
              width={rectW}
              height={rectH}
              fill="none"
              stroke="url(#nfBorderGrad)"
              strokeWidth={BORDER_W + 10}
              strokeDasharray={`${LIGHT_LEN * 2} ${gapOuter}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
          )}

          {/* Sharp gradient core chasing around — first open only */}
          {animating && (
            <AnimatedRect
              x={bx}
              y={bx}
              width={rectW}
              height={rectH}
              fill="none"
              stroke="url(#nfBorderGrad)"
              strokeWidth={BORDER_W + 2}
              strokeDasharray={`${LIGHT_LEN} ${gap}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeOpacity="1"
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

# Add project specific ProGuard rules here.
# Release: minifyEnabled + shrinkResources (Play Store DEX optimization).
# https://developer.android.com/topic/performance/app-optimization/enable-app-optimization

# ---- React Native / Hermes ----
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# ---- Reanimated / Worklets ----
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# ---- Expo ----
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# ---- LiveKit / WebRTC ----
-keep class io.livekit.** { *; }
-keep class livekit.** { *; }
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
-keep class com.oney.WebRTCModule.** { *; }

# ---- OkHttp / Okio (RN networking) ----
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ---- JSON / Gson (varsa) ----
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- Foreground service / notifications ----
-keep class com.supersami.** { *; }
-keep class androidx.work.** { *; }

# ---- React Native SVG / Gesture ----
-keep public class com.horcrux.svg.** { *; }

# Crashlytics / Play mapping için satır numaralarını koru
-keepattributes LineNumberTable,SourceFile

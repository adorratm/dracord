package com.dracord.mobile

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private var handledNewIntent = false

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  override fun onStart() {
    super.onStart()
    if (!handledNewIntent) {
      emitVoiceNotificationAction(intent)
    }
    handledNewIntent = false
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handledNewIntent = true
    emitVoiceNotificationAction(intent)
  }

  /**
   * Foreground service bildirim butonlarından gelen aksiyonları JS'e iletir.
   * (@supersami/rn-foreground-service MainActivity'si Expo'da kullanılmadığı için burada.)
   */
  private fun emitVoiceNotificationAction(intent: Intent?) {
    if (intent == null) return
    val main = intent.getStringExtra("mainOnPress")
    val button = intent.getStringExtra("buttonOnPress")
    val button2 = intent.getStringExtra("button2OnPress")
    if (main == null && button == null && button2 == null) return

    val map = Arguments.createMap()
    if (main != null) map.putString("main", main)
    if (button != null) map.putString("button", button)
    if (button2 != null) map.putString("button2", button2)

    try {
      val ctx = reactInstanceManager?.currentReactContext ?: return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("notificationClickHandle", map)
    } catch (e: Exception) {
      Log.e("DracordVoice", "notificationClickHandle emit failed: ${e.message}")
    }

    // Tekrar tetiklenmesin
    intent.removeExtra("mainOnPress")
    intent.removeExtra("buttonOnPress")
    intent.removeExtra("button2OnPress")
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish activities.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}

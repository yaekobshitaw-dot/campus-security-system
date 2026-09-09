package com.anonymous.campussecurity

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {
  private val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
    override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

    override fun getPackages(): MutableList<ReactPackage> = PackageList(this).packages.toMutableList()

    override fun getJSMainModuleName(): String = "index"

    override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

    override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
  }

  override fun getReactNativeHost(): ReactNativeHost = reactNativeHost

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load()
    }
  }
}

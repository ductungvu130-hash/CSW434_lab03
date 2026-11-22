package com.lab3.sensors

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SensorPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NfcModule.NAME -> NfcModule(reactContext)
            CompassModule.NAME -> CompassModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        listOf(NfcModule.NAME, CompassModule.NAME).associateWith { name ->
            ReactModuleInfo(name, name, false, false, false, true)
        }
    }
}

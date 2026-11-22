package com.lab3.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Surface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.common.LifecycleState
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = CompassModule.NAME)
class CompassModule(private val context: ReactApplicationContext) :
    NativeCompassSpec(context), SensorEventListener, LifecycleEventListener {

    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val magnetometer = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
    private val accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val handler = Handler(Looper.getMainLooper())
    private val magnetic = FloatArray(3)
    private val gravity = FloatArray(3)
    private val rotation = FloatArray(9)
    private val remapped = FloatArray(9)
    private val orientation = FloatArray(3)
    private var hasMagnetic = false
    private var hasGravity = false
    private var requested = false
    private var active = false
    private var valid = true
    private var accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE
    private var lastEmission = 0L

    init {
        context.addLifecycleEventListener(this)
    }

    override fun getName() = NAME

    override fun start() {
        handler.post {
            requested = true
            registerSensors()
        }
    }

    override fun stop() {
        handler.post {
            requested = false
            unregisterSensors()
        }
    }

    private fun registerSensors() {
        if (!valid || !requested || active) return
        if (magnetometer == null || accelerometer == null) {
            sendStatus("Thiết bị thiếu cảm biến từ trường hoặc gia tốc kế.")
            return
        }
        if (context.lifecycleState != LifecycleState.RESUMED) return
        hasMagnetic = false
        hasGravity = false
        lastEmission = 0L
        val magneticRegistered = manager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME, handler)
        val gravityRegistered = manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME, handler)
        active = magneticRegistered && gravityRegistered
        if (!active) manager.unregisterListener(this)
        sendStatus(if (active) "Giữ điện thoại nằm ngang và xoay để xem hướng." else "Không thể khởi động cảm biến.")
    }

    private fun unregisterSensors() {
        manager.unregisterListener(this)
        active = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!active || !valid) return
        when (event.sensor.type) {
            Sensor.TYPE_MAGNETIC_FIELD -> {
                filter(event.values, magnetic, hasMagnetic)
                hasMagnetic = true
                accuracy = event.accuracy
            }
            Sensor.TYPE_ACCELEROMETER -> {
                filter(event.values, gravity, hasGravity)
                hasGravity = true
            }
            else -> return
        }
        if (!hasMagnetic || !hasGravity) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastEmission < 80L) return
        if (!SensorManager.getRotationMatrix(rotation, null, gravity, magnetic)) return
        val displayRotation = context.currentActivity?.windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        val axes = when (displayRotation) {
            Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
            Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
            Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
            else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
        }
        if (!SensorManager.remapCoordinateSystem(rotation, axes.first, axes.second, remapped)) return
        SensorManager.getOrientation(remapped, orientation)
        val heading = (Math.toDegrees(orientation[0].toDouble()) + 360.0) % 360.0
        lastEmission = now
        emitOnHeadingChanged(Arguments.createMap().apply {
            putDouble("heading", heading)
            putDouble("x", magnetic[0].toDouble())
            putDouble("y", magnetic[1].toDouble())
            putDouble("z", magnetic[2].toDouble())
            putDouble("accuracy", accuracy.toDouble())
        })
    }

    private fun filter(input: FloatArray, output: FloatArray, initialized: Boolean) {
        for (index in 0..2) {
            output[index] = if (initialized) output[index] + 0.2f * (input[index] - output[index]) else input[index]
        }
    }

    override fun onAccuracyChanged(sensor: Sensor, value: Int) {
        if (sensor.type == Sensor.TYPE_MAGNETIC_FIELD) accuracy = value
    }

    private fun sendStatus(message: String) {
        if (!valid) return
        emitOnStatusChanged(Arguments.createMap().apply {
            putBoolean("available", magnetometer != null && accelerometer != null)
            putBoolean("active", active)
            putString("message", message)
        })
    }

    override fun onHostResume() {
        registerSensors()
    }

    override fun onHostPause() {
        unregisterSensors()
    }

    override fun onHostDestroy() {
        unregisterSensors()
    }

    override fun invalidate() {
        valid = false
        context.removeLifecycleEventListener(this)
        handler.post { unregisterSensors() }
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeCompass"
    }
}

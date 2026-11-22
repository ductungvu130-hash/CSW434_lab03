import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type CompassReading = {
  heading: number;
  x: number;
  y: number;
  z: number;
  accuracy: number;
};

export type CompassStatus = {
  available: boolean;
  active: boolean;
  message: string;
};

export interface Spec extends TurboModule {
  start(): void;
  stop(): void;
  readonly onHeadingChanged: CodegenTypes.EventEmitter<CompassReading>;
  readonly onStatusChanged: CodegenTypes.EventEmitter<CompassStatus>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeCompass');

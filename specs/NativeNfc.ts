import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type NdefRecordData = {
  tnf: number;
  type: string;
  id: string;
  payload: string;
  text: string;
};

export type NfcTagData = {
  id: string;
  technologies: Array<string>;
  records: Array<NdefRecordData>;
  mock: boolean;
};

export type NfcStatus = {
  available: boolean;
  enabled: boolean;
  scanning: boolean;
  message: string;
};

export interface Spec extends TurboModule {
  startScanning(): void;
  stopScanning(): void;
  openSettings(): void;
  mockNdefRecord(text: string): void;
  readonly onTagDiscovered: CodegenTypes.EventEmitter<NfcTagData>;
  readonly onStatusChanged: CodegenTypes.EventEmitter<NfcStatus>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeNfc');

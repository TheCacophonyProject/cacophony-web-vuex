import CacophonyApi from "./CacophonyApi";
import * as querystring from "querystring";
import { shouldViewAsSuperUser } from "@/utils";
import recording, { DeviceId } from "./Recording.api";

export default {
  getDevices,
  getDevice,
  addUserToDevice,
  removeUserFromDevice,
  getLatestSoftwareVersion,
  getLatestEvents,
  getType,
};

export interface DeviceInfo {
  deviceName: string;
  groupName: string;
  id: number;
  users?: UserDetails;
}

export interface UserDetails {
  userName: string;
  id: number;
  admin: boolean;
}

function getDevices() {
  return CacophonyApi.get(
    `/api/v1/devices${shouldViewAsSuperUser() ? "" : "?view-mode=user"}`
  );
}

function getDevice(groupName: string, deviceName: string) {
  return CacophonyApi.get(
    `/api/v1/devices/${deviceName}/in-group/${groupName}`
  );
}

function addUserToDevice(username, deviceId, admin) {
  const suppressGlobalMessaging = true;

  return CacophonyApi.post(
    "/api/v1/devices/users",
    {
      username: username,
      deviceId: deviceId,
      admin: admin,
    },
    suppressGlobalMessaging
  );
}

function removeUserFromDevice(username: string, deviceId: number) {
  return CacophonyApi.delete("/api/v1/devices/users", {
    username,
    deviceId,
  });
}

function getLatestSoftwareVersion(deviceId: number) {
  const params: EventApiParams = {
    limit: 1,
    type: "versionData",
  };
  return getLatestEvents(deviceId, params);
}

export const DeviceEventTypes = [
  "alert",
  "attiny-sleep",
  "audioBait",
  "daytime-power-off",
  "powered-off",
  "power-on-test",
  "rpi-power-on",
  "salt-update",
  "systemError",
  "test",
  "throttle",
  "versionData",
] as const;

type IsoFormattedString = string;

export type DeviceEventType = typeof DeviceEventTypes[number];

export interface EventApiParams {
  limit?: number;
  offset?: number;
  type?: DeviceEventType | DeviceEventType[];
  endTime?: IsoFormattedString; // Or in the format YYYY-MM-DD hh:mm:ss
  startTime?: IsoFormattedString;
}

export interface DeviceEvent {
  id: number;
  dateTime: IsoFormattedString;
  createdAt: IsoFormattedString;
  DeviceId: DeviceId;
  Device: { devicename: string };
  EventDetail: {
    type: DeviceEventType;
    details?: any;
  };
}

function getLatestEvents(
  deviceId: number,
  params?: EventApiParams
): Promise<{ result: { rows: DeviceEvent[] } }> {
  return CacophonyApi.get(
    `/api/v1/events?latest=true&deviceId=${deviceId}&${querystring.stringify(
      params as any
    )}`
  );
}

async function getType(
  deviceId: number
): Promise<"AudioRecorder" | "VideoRecorder" | "UnknownDeviceType"> {
  const rec = await recording.latestForDevice(deviceId);
  if (rec.result.rows.length) {
    const type = rec.result.rows[0].type;
    return type === "thermalRaw" ? "VideoRecorder" : "AudioRecorder";
  }
  return "UnknownDeviceType";
}

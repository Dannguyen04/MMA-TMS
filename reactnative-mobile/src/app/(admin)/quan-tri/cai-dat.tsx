import { Redirect, type Href } from "expo-router";

/** Hidden in step 23 (no backend API; Giao diện is in Tôi): old links go to Tổng quan. */
export default function AdminHiddenToolRoute() {
  return <Redirect href={"/(admin)" as Href} />;
}

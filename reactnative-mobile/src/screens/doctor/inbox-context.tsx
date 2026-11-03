import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { SlideSheet } from "@/components/ui/slide-sheet";
import { doctor } from "@/i18n/doctor";
import { DoctorPushDeliveryNote, DoctorPushRationale } from "@/notifications/doctor-os-notifications";
import { NotificationInbox } from "@/screens/notifications/inbox";

type InboxValue = { open: () => void; close: () => void };

const InboxContext = createContext<InboxValue | null>(null);

export function DoctorInboxProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(
    () => ({ open: () => setVisible(true), close: () => setVisible(false) }),
    [],
  );
  return (
    <InboxContext.Provider value={value}>
      {children}
      <SlideSheet visible={visible} onClose={value.close} title={doctor.inbox.title}>
        <DoctorPushRationale />
        <DoctorPushDeliveryNote includeGap />
        <NotificationInbox title="" showWhen />
      </SlideSheet>
    </InboxContext.Provider>
  );
}

export function useDoctorInbox(): InboxValue | null {
  return useContext(InboxContext);
}

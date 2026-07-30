/**
 * 同门 · 众生之厅 — client data layer.
 *
 * One React Query cache for the whole hall: the mailbox RPC already returns
 * received letters, sent letters, echoes, my replies and notifications, so
 * every page reads the same query key and mutations simply invalidate it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import {
  getMyCommunityMailbox,
  getMyCommunityProfile,
  replyToCommunityLetter,
  reportCommunityContent,
  sendCommunityLetter,
  setCommunityBlock,
  setCommunityDeliveryState,
  blockCommunityLetterAuthor,
  setCommunityEchoSaved,
  closeCommunityLetter,
  upsertMyCommunityProfile,
  type CommunityMailbox,
} from "@/lib/community-hall.functions";

export const communityKeys = {
  profile: ["community-hall", "profile"] as const,
  mailbox: ["community-hall", "mailbox"] as const,
};

export type CommunityProfileInput = {
  alias?: string | null;
  academy?: string | null;
  element?: string | null;
  avatarUrl?: string | null;
  quote?: string | null;
  language: "zh" | "en";
  optIn: boolean;
  paused: boolean;
};

export type SendLetterInput = {
  subject?: string | null;
  body: string;
  topic?: string | null;
  targetAgeBand: string;
  responseStyle?: string | null;
};

export type ReportInput = {
  targetType: "letter" | "reply" | "profile";
  targetId: string;
  reason: string;
  details?: string | null;
};

export type CommunityProfileState = Awaited<ReturnType<typeof getMyCommunityProfile>>;

export function useCommunityProfile(enabled = true) {
  const load = useServerFn(getMyCommunityProfile);
  return useQuery({
    queryKey: communityKeys.profile,
    queryFn: () => load(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCommunityMailbox(enabled = true) {
  const load = useServerFn(getMyCommunityMailbox);
  return useQuery<CommunityMailbox>({
    queryKey: communityKeys.mailbox,
    queryFn: () => load(),
    enabled,
    staleTime: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: communityKeys.mailbox });
    void qc.invalidateQueries({ queryKey: communityKeys.profile });
  }, [qc]);
}

export function useSaveCommunityProfile() {
  const save = useServerFn(upsertMyCommunityProfile);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: CommunityProfileInput) => save({ data }),
    onSuccess: invalidate,
  });
}

export function useSendLetter() {
  const send = useServerFn(sendCommunityLetter);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: SendLetterInput) => send({ data }),
    onSuccess: invalidate,
  });
}

export function useReplyToLetter() {
  const reply = useServerFn(replyToCommunityLetter);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { letterId: string; body: string }) => reply({ data }),
    onSuccess: invalidate,
  });
}

export function useDeliveryState() {
  const setState = useServerFn(setCommunityDeliveryState);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { letterId: string; state: "read" | "archived" | "restore" }) =>
      setState({ data }),
    onSuccess: invalidate,
  });
}

export function useReportContent() {
  const report = useServerFn(reportCommunityContent);
  return useMutation({
    mutationFn: (data: ReportInput) => report({ data }),
  });
}

export function useBlockTraveler() {
  const block = useServerFn(setCommunityBlock);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { userId: string; blocked: boolean }) => block({ data }),
    onSuccess: invalidate,
  });
}

/** Block a letter's anonymous author without ever exposing their user id. */
export function useBlockLetterAuthor() {
  const block = useServerFn(blockCommunityLetterAuthor);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { letterId: string }) => block({ data }),
    onSuccess: invalidate,
  });
}

/** Author-only: keep an echo on the private shelf. */
export function useSaveEcho() {
  const save = useServerFn(setCommunityEchoSaved);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { replyId: string; saved: boolean }) => save({ data }),
    onSuccess: invalidate,
  });
}

/** Author-only: stop collecting echoes for one letter. */
export function useCloseLetter() {
  const close = useServerFn(closeCommunityLetter);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { letterId: string }) => close({ data }),
    onSuccess: invalidate,
  });
}

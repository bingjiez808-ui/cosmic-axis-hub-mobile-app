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
  deleteMyCommunityHallData,
  getCommunityLetterDispatchState,
  getCommunityLibrarySamples,
  getCommunityPublicLetter,
  getCommunityPublicWall,
  markCommunityOnboarded,
  markCommunityNotificationsRead,
  requestCommunityLetterWave,
  upsertMyCommunityProfile,
  type CommunityMailbox,
} from "@/lib/community-hall.functions";

export const communityKeys = {
  profile: ["community-hall", "profile"] as const,
  mailbox: ["community-hall", "mailbox"] as const,
  samples: (lang: string) => ["community-hall", "samples", lang] as const,
  dispatch: (letterId: string) => ["community-hall", "dispatch", letterId] as const,
  wall: ["community-hall", "wall"] as const,
  wallLetter: (letterId: string) => ["community-hall", "wall", letterId] as const,
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
  acceptsAssignments?: boolean;
};

export type SendLetterInput = {
  subject?: string | null;
  body: string;
  topic?: string | null;
  targetAgeBand: string;
  responseStyle?: string | null;
  /** 'delivered_only' = courier picks the readers; 'wall' = public board. */
  visibility?: "delivered_only" | "wall";
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
  const qc = useQueryClient();
  const send = useServerFn(sendCommunityLetter);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: SendLetterInput) => send({ data }),
    onSuccess: () => {
      invalidate();
      // A letter posted to the public board must appear on the wall at once.
      void qc.invalidateQueries({ queryKey: communityKeys.wall });
    },
  });
}

export function useReplyToLetter() {
  const qc = useQueryClient();
  const reply = useServerFn(replyToCommunityLetter);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { letterId: string; body: string }) => reply({ data }),
    onSuccess: (_r, variables) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: communityKeys.wall });
      void qc.invalidateQueries({ queryKey: communityKeys.wallLetter(variables.letterId) });
    },
  });
}

/** The open board: letters whose authors chose 公共信墙 instead of a courier run. */
export function useCommunityPublicWall(enabled = true) {
  const load = useServerFn(getCommunityPublicWall);
  return useQuery({
    queryKey: communityKeys.wall,
    queryFn: () => load({ data: { limit: 30 } }),
    enabled,
    staleTime: 15_000,
    // The wall is a shared board: keep it fresh while the tab is open so a
    // letter posted from another device shows up without a manual reload.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** One public letter with its echoes; only fetched once a card is opened. */
export function useCommunityPublicLetter(letterId: string | null) {
  const load = useServerFn(getCommunityPublicLetter);
  return useQuery({
    queryKey: communityKeys.wallLetter(letterId ?? "none"),
    queryFn: () => load({ data: { letterId: letterId as string } }),
    enabled: Boolean(letterId),
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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

/** Author-only: live delivery telemetry for one sent letter. */
export function useLetterDispatchState(letterId: string, enabled = true) {
  const load = useServerFn(getCommunityLetterDispatchState);
  return useQuery({
    queryKey: communityKeys.dispatch(letterId),
    queryFn: () => load({ data: { letterId } }),
    enabled: enabled && Boolean(letterId),
    staleTime: 60_000,
  });
}

/** Author-only: release the next delivery wave for a letter still waiting. */
export function useRequestLetterWave() {
  const qc = useQueryClient();
  const request = useServerFn(requestCommunityLetterWave);
  return useMutation({
    mutationFn: (data: { letterId: string }) => request({ data }),
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: communityKeys.mailbox });
      void qc.invalidateQueries({ queryKey: communityKeys.dispatch(variables.letterId) });
    },
  });
}

/** Curated cold-start letters, always rendered with a "library sample" label. */
export function useCommunityLibrarySamples(language: "zh" | "en") {
  const load = useServerFn(getCommunityLibrarySamples);
  return useQuery({
    queryKey: communityKeys.samples(language),
    queryFn: () => load({ data: { language, limit: 12 } }),
    staleTime: 10 * 60_000,
  });
}

/** Mark the onboarding cards as seen (idempotent server-side). */
export function useMarkOnboarded() {
  const qc = useQueryClient();
  const mark = useServerFn(markCommunityOnboarded);
  return useMutation({
    mutationFn: () => mark({ data: undefined }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: communityKeys.profile }),
  });
}

/** Notification centre: mark a batch of notifications as read. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const mark = useServerFn(markCommunityNotificationsRead);
  return useMutation({
    mutationFn: (ids: string[]) => mark({ data: { ids } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: communityKeys.mailbox }),
  });
}

/** Privacy: erase this member's whole footprint in the hall. */
export function useDeleteMyCommunityData() {
  const qc = useQueryClient();
  const run = useServerFn(deleteMyCommunityHallData);
  return useMutation({
    mutationFn: () => run({ data: undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.profile });
      void qc.invalidateQueries({ queryKey: communityKeys.mailbox });
    },
  });
}

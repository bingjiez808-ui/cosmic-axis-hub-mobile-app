/**
 * 历代先贤 / 图书管理员 — client data layer.
 *
 * Separate cache namespace from the mailbox so the sage desk, the assignment
 * list and the librarian desk each refresh independently of the courier flow.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  askSagePersona,
  assignLetterToTraveler,
  getLibrarianDesk,
  getMyDeskLetters,
  getMyLetterAssignments,
  getSageEntitlement,
  requestHumanReplyForLetter,
  respondToLetterAssignment,
  sendLetterToLibrarian,
} from "@/lib/sage-council.functions";

export const sageKeys = {
  entitlement: ["sage-council", "entitlement"] as const,
  desk: (route: string) => ["sage-council", "desk", route] as const,
  assignments: ["sage-council", "assignments"] as const,
  librarian: ["sage-council", "librarian"] as const,
};

export function useSageEntitlement(enabled = true) {
  const load = useServerFn(getSageEntitlement);
  return useQuery({
    queryKey: sageKeys.entitlement,
    queryFn: () => load(),
    enabled,
    staleTime: 60_000,
  });
}

export function useDeskLetters(route: "sage" | "librarian", enabled = true) {
  const load = useServerFn(getMyDeskLetters);
  return useQuery({
    queryKey: sageKeys.desk(route),
    queryFn: () => load({ data: { route } }),
    enabled,
    staleTime: 20_000,
  });
}

export function useAskSage() {
  const qc = useQueryClient();
  const call = useServerFn(askSagePersona);
  return useMutation({
    mutationFn: (data: {
      personaId: string;
      subject?: string | null;
      body: string;
      topic?: string | null;
      targetAgeBand: string;
      lang: "zh" | "en";
    }) => call({ data: data as never }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sageKeys.desk("sage") });
      void qc.invalidateQueries({ queryKey: sageKeys.entitlement });
    },
  });
}

export function useSendToLibrarian() {
  const qc = useQueryClient();
  const call = useServerFn(sendLetterToLibrarian);
  return useMutation({
    mutationFn: (data: {
      subject?: string | null;
      body: string;
      topic?: string | null;
      targetAgeBand: string;
      responseStyle?: string | null;
    }) => call({ data: data as never }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sageKeys.desk("librarian") });
    },
  });
}

export function useRequestHumanReply() {
  const qc = useQueryClient();
  const call = useServerFn(requestHumanReplyForLetter);
  return useMutation({
    mutationFn: (data: { letterId: string }) => call({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sageKeys.desk("sage") });
      void qc.invalidateQueries({ queryKey: sageKeys.desk("librarian") });
      void qc.invalidateQueries({ queryKey: sageKeys.entitlement });
    },
  });
}

export function useMyAssignments(enabled = true) {
  const load = useServerFn(getMyLetterAssignments);
  return useQuery({
    queryKey: sageKeys.assignments,
    queryFn: () => load(),
    enabled,
    staleTime: 20_000,
  });
}

export function useRespondToAssignment() {
  const qc = useQueryClient();
  const call = useServerFn(respondToLetterAssignment);
  return useMutation({
    mutationFn: (data: { assignmentId: string; accept: boolean }) => call({ data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sageKeys.assignments }),
  });
}

export function useLibrarianDesk(enabled = true) {
  const load = useServerFn(getLibrarianDesk);
  return useQuery({
    queryKey: sageKeys.librarian,
    queryFn: () => load(),
    enabled,
    retry: false,
    staleTime: 20_000,
  });
}

export function useAssignLetter() {
  const qc = useQueryClient();
  const call = useServerFn(assignLetterToTraveler);
  return useMutation({
    mutationFn: (data: { letterId: string; assigneeId: string; note?: string | null }) =>
      call({ data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sageKeys.librarian }),
  });
}

import type { EventStatus, EventType } from "@prisma/client";

export type EventPerson = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  email: string | null;
  cpf: string | null;
};

export type EventMinistry = {
  id: string;
  name: string;
  color: string;
};

export type EventSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: EventType;
  status: EventStatus;
  ministry: EventMinistry | null;
  responsibleMember: EventPerson | null;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  address: string | null;
  capacity: number | null;
  requiresRegistration: boolean;
  isPublic: boolean;
  imageUrl: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventListResult = {
  events: EventSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    ministries: EventMinistry[];
    members: EventPerson[];
  };
};

export type EventFormValues = {
  title: string;
  description?: string;
  type: EventType;
  status: EventStatus;
  ministryId?: string;
  responsibleMemberId?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  address?: string;
  capacity?: number | "";
  requiresRegistration: boolean;
  isPublic: boolean;
  imageUrl?: string;
  observations?: string;
};

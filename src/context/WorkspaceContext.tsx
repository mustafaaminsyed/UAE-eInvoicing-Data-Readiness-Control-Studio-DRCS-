import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { DatasetType } from '@/types/datasets';
import { DEFAULT_DIRECTION, Direction, OrganizationProfile } from '@/types/direction';
import { resolveDirection } from '@/lib/direction/directionUtils';

export interface WorkspaceContextType {
  direction: Direction;
  activeDatasetType: DatasetType;
  setDirection: (direction: Direction) => void;
  setActiveDatasetType: (datasetType: DatasetType) => void;
  organizationProfile: OrganizationProfile;
  setOrganizationProfile: (profile: OrganizationProfile) => void;
  uploadSessionId: string | null;
  setUploadSessionId: (value: string | null) => void;
  uploadManifestId: string | null;
  setUploadManifestId: (value: string | null) => void;
  activeMappingProfileByDirection: Record<Direction, { id: string; version: number } | null>;
  setActiveMappingProfileForDirection: (direction: Direction, profile: { id: string; version: number } | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const DIRECTION_STORAGE_KEY = 'drcs_direction_v1';
const ORG_PROFILE_STORAGE_KEY = 'drcs_org_profile_v1';
const ACTIVE_MAPPING_STORAGE_KEY = 'drcs_active_mapping_profiles_v1';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [direction, setDirectionState] = useState<Direction>(() => {
    try {
      const stored = localStorage.getItem(DIRECTION_STORAGE_KEY);
      return resolveDirection(stored);
    } catch {
      return DEFAULT_DIRECTION;
    }
  });
  const [organizationProfile, setOrganizationProfile] = useState<OrganizationProfile>(() => {
    const envTRNs =
      (import.meta.env.VITE_OUR_ENTITY_TRNS as string | undefined)
        ?.split(',')
        .map((v) => v.trim())
        .filter(Boolean) || [];

    try {
      const stored = localStorage.getItem(ORG_PROFILE_STORAGE_KEY);
      if (!stored) return { ourEntityTRNs: envTRNs };
      const parsed = JSON.parse(stored) as OrganizationProfile;
      return { ourEntityTRNs: parsed.ourEntityTRNs || envTRNs, entityIds: parsed.entityIds || [] };
    } catch {
      return { ourEntityTRNs: envTRNs };
    }
  });
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadManifestId, setUploadManifestId] = useState<string | null>(null);
  const [activeMappingProfileByDirection, setActiveMappingProfileByDirection] = useState<Record<Direction, { id: string; version: number } | null>>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_MAPPING_STORAGE_KEY);
      if (!stored) return { AR: null, AP: null };
      const parsed = JSON.parse(stored) as Record<Direction, { id: string; version: number } | null>;
      return { AR: parsed.AR || null, AP: parsed.AP || null };
    } catch {
      return { AR: null, AP: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
  }, [direction]);

  useEffect(() => {
    localStorage.setItem(ORG_PROFILE_STORAGE_KEY, JSON.stringify(organizationProfile));
  }, [organizationProfile]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_MAPPING_STORAGE_KEY, JSON.stringify(activeMappingProfileByDirection));
  }, [activeMappingProfileByDirection]);

  const setDirection = (nextDirection: Direction) => {
    setDirectionState(nextDirection);
  };

  const setActiveDatasetType = (datasetType: DatasetType) => {
    setDirectionState(datasetType);
  };

  const setActiveMappingProfileForDirection = (
    targetDirection: Direction,
    profile: { id: string; version: number } | null
  ) => {
    setActiveMappingProfileByDirection((prev) => ({ ...prev, [targetDirection]: profile }));
  };

  const value = useMemo(
    () => ({
      direction,
      activeDatasetType: direction,
      setDirection,
      setActiveDatasetType,
      organizationProfile,
      setOrganizationProfile,
      uploadSessionId,
      setUploadSessionId,
      uploadManifestId,
      setUploadManifestId,
      activeMappingProfileByDirection,
      setActiveMappingProfileForDirection,
    }),
    [
      direction,
      organizationProfile,
      uploadSessionId,
      uploadManifestId,
      activeMappingProfileByDirection,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
}

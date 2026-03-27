export type ArchivedWorkerForDb = {
  workerName: string; // brut WS: address.worker
  worker: string; // public => vrai suffixe, privé => worker1/worker2...
  addressId: string;
  addressLabel: string;
  rawAddress: string;
  isPublic: boolean;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
};

export type ArchivedRoundSnapshotForDb = {
  roundKey: string;
  startedAt: number | null;
  endedAt: number;
  workers: ArchivedWorkerForDb[];
};
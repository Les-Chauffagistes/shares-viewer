export type RawShareMessage = {
  type: "share";
  replay?: boolean;
  share: {
    workinfoid: number;
    clientid: number;
    diff: number;
    sdiff: number;
    hash: string;
    result: boolean;
    errn: number;
    createdate: string;
    ts: number;
    workername: string;
    username: string;
    address: string;
    worker?: string;
    ip?: string;
    agent?: string;
    rejectReason?: string | null;
    round: string;
    file?: string;
  };
};

export type WorkerState = {
  workerName: string;
  address: string;
  displayName: string;
  bestSdiff: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};

export type LiveWorkerState = {
  workerName: string;
  address: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};

export type LiveAddressState = {
  address: string;
  displayAddress: string;
  workerNames: string[];
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};

export type ArchivedRoundWorker = {
  workerName: string;
  address: string;
  displayName: string;
  bestShare: number;
  sharesCount: number;
  lastShareTs: number;
};

export type ArchivedRoundSnapshot = {
  roundKey: string;
  startedAt?: number | null;
  endedAt: number;
  workers: ArchivedRoundWorker[];
};

export type WorkerRoundStatDto = {
  id: number;
  roundKey: string;
  workerName: string; // brut
  worker: string;     // suffixe
  address: string;    // label ou id selon ton API
  displayName: string; // calculé côté backend avant envoi
  bestShare: number;
  sharesCount: number;
  rank: number;
  participated: boolean;
  streakAtTime: number;
  xpGained: number;
  totalXpAfter: number;
  levelAfter: number;
};

export type RoundArchiveDto = {
  id: number;
  roundKey: string;
  startedAt: string | null;
  endedAt: string;
  workersCount: number;
  sharesCount: number;
  bestShare: number;
  createdAt: string;
  workerStats: WorkerRoundStatDto[];
};
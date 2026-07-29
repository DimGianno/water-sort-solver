import {
  Binary,
  MongoClient,
  ServerApiVersion,
  type MongoClientOptions,
} from "mongodb";

declare const process: {
  env: Record<string, string | undefined>;
};

const DATABASE_NAME = "chromaflow";
const COLLECTION_NAME = "levels";
const MIN_BOTTLES = 4;
const MAX_BOTTLES = 14;
const COMPACT_CODEC_VERSION = 1;
const MAX_COLOR_CODE = 12;

interface StoredLevel {
  level: number;
  puzzle: Binary;
  solvable: boolean;
  updated_at?: Date;
}

export interface KnownLevel {
  level: number;
  code: string;
  updatedAt?: string;
}

type LoadKnownLevels = () => Promise<KnownLevel[]>;

let clientPromise: Promise<MongoClient> | null = null;

function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (!clientPromise) {
    const options = {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 5_000,
    } as MongoClientOptions;
    const client = new MongoClient(uri, options);
    clientPromise = client.connect().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

function compactPuzzleCode(puzzle: Binary): string | null {
  if (puzzle.sub_type !== Binary.SUBTYPE_DEFAULT) return null;

  const bytes = puzzle.value();
  if (!bytes.length) return null;

  const version = bytes[0] >> 4;
  const bottleCount = bytes[0] & 0x0f;
  if (
    version !== COMPACT_CODEC_VERSION ||
    bottleCount < MIN_BOTTLES ||
    bottleCount > MAX_BOTTLES ||
    bytes.length !== 1 + bottleCount * 2
  ) {
    return null;
  }

  for (let index = 1; index < bytes.length; index++) {
    if (bytes[index] >> 4 > MAX_COLOR_CODE) return null;
    if ((bytes[index] & 0x0f) > MAX_COLOR_CODE) return null;
  }

  return `WS1:${puzzle.toString("base64")}`;
}

export function formatLevelDocuments(
  documents: ReadonlyArray<Partial<StoredLevel>>,
): KnownLevel[] {
  const levels = new Map<number, KnownLevel>();

  for (const document of documents) {
    if (
      document.solvable !== true ||
      !Number.isSafeInteger(document.level) ||
      Number(document.level) <= 0 ||
      !(document.puzzle instanceof Binary)
    ) {
      continue;
    }

    const level = Number(document.level);
    if (levels.has(level)) continue;

    const code = compactPuzzleCode(document.puzzle);
    if (!code) continue;

    const knownLevel: KnownLevel = { level, code };
    if (
      document.updated_at instanceof Date &&
      !Number.isNaN(document.updated_at.getTime())
    ) {
      knownLevel.updatedAt = document.updated_at.toISOString();
    }
    levels.set(level, knownLevel);
  }

  return [...levels.values()].sort((left, right) => left.level - right.level);
}

async function loadKnownLevels(): Promise<KnownLevel[]> {
  const client = await getMongoClient();
  const documents = await client
    .db(DATABASE_NAME)
    .collection<StoredLevel>(COLLECTION_NAME)
    .find(
      { solvable: true },
      {
        projection: {
          _id: 0,
          level: 1,
          puzzle: 1,
          solvable: 1,
          updated_at: 1,
        },
      },
    )
    .sort({ level: 1, updated_at: -1 })
    .toArray();

  return formatLevelDocuments(documents);
}

export function createLevelsHandler(loadLevels: LoadKnownLevels) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405, headers: { Allow: "GET" } },
        );
      }

      try {
        const levels = await loadLevels();
        return Response.json(
          { levels },
          {
            headers: {
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            },
          },
        );
      } catch (error) {
        console.error("Known-level request failed.", error);
        return Response.json(
          { error: "Known levels are temporarily unavailable." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    },
  };
}

export default createLevelsHandler(loadKnownLevels);

export type DatasetType = 'AR' | 'AP';
export type DatasetRunScope = DatasetType | 'ALL';

export interface DatasetBundle<T> {
  AR: T;
  AP: T;
}

export const DEFAULT_DATASET_TYPE: DatasetType = 'AR';

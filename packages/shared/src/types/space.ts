export interface SpaceDto {
  id: string;
  name: string;
  parentSpaceId: string | null;
  position: number;
  createdAt: string;
}

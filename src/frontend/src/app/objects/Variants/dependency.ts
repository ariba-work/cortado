export class Dependency {
  source: string;
  target: string;
  is_followed: boolean;
  connects_sync_moves: boolean;

  constructor(
    source: string,
    target: string,
    isFollowed: boolean,
    connectsSyncMoves: boolean
  ) {
    this.source = source;
    this.target = target;
    this.is_followed = isFollowed;
    this.connects_sync_moves = connectsSyncMoves;
  }

  // Static method to create a Dependency from a JSON object
  static fromJSON(data: {
    source: string;
    target: string;
    is_followed: boolean;
    connects_sync_moves: boolean;
  }): Dependency {
    return new Dependency(
      data.source,
      data.target,
      data.is_followed,
      data.connects_sync_moves
    );
  }
}

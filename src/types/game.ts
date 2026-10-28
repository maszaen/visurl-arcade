import React from 'react';

export type RLAlgorithmType = 'Q-Table' | 'Deep Q-Learning (MLP)' | 'Policy Gradient' | 'Heuristic Q-Learning';

export interface GameMetadata {
  id: string;
  name: string;
  tagline: string;
  description: string;
  detailedDescription?: string;
  algorithm: RLAlgorithmType;
  agentsCount: number;
  tags: string[];
  stateSpace: string;
  actionSpace: string;
  rewardScheme: string;
  badge: string;
  accentColor: string;
  secondaryColor?: string;
  iconType: 'tetris' | 'snake' | 'grid' | 'generic';
  isReady: boolean;
  version: string;
}

export interface GameDefinition extends GameMetadata {
  component: React.ComponentType<{ onBackToLobby?: () => void }>;
}

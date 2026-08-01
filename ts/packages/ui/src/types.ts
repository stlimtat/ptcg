import { Card, CardInstance } from '@pokemon-tcg/engine';

export interface CardRegistry {
  [cardId: string]: Card;
}

export type UIAction = {
  type: string;
  [key: string]: any;
};

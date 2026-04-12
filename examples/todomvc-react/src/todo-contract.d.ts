import type { AICMetadataProps } from "@aicorg/sdk-react";
import type { Todo } from "./types";

export const TODO_VIEW: {
  url: string;
  view_id: string;
};

export const NEW_TODO_INPUT_PROPS: AICMetadataProps;
export const TOGGLE_ALL_PROPS: AICMetadataProps;

export function createTodoToggleProps(todo: Todo): AICMetadataProps;
export function createTodoDeleteProps(todo: Todo): AICMetadataProps;
export function createTodoEditInputProps(todo: Todo): AICMetadataProps;

export const FILTER_ALL_PROPS: AICMetadataProps;
export const FILTER_ACTIVE_PROPS: AICMetadataProps;
export const FILTER_COMPLETED_PROPS: AICMetadataProps;

export function createClearCompletedProps(completedCount: number): AICMetadataProps;

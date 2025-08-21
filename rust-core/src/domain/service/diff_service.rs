use serde::Serialize;
use std::collections::{HashMap, HashSet};
use crate::domain::model::document::{ActionItem, Chunk};

#[derive(Serialize, Debug, PartialEq)]
pub enum DiffStatus {
    Added,
    Removed,
    Unchanged,
    Modified,
}

#[derive(Serialize, Debug)]
pub struct DiffEntry<T> {
    pub status: DiffStatus,
    #[serde(rename = "item_to")]
    pub item: T,
    #[serde(skip_serializing_if = "Option::is_none", rename = "item_from")]
    pub modified_from: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_distance: Option<f32>,
}

#[derive(Serialize, Debug, Default)]
pub struct StructuralDiff {
    pub action_items_diff: Vec<DiffEntry<ActionItem>>,
    pub chunks_diff: Vec<DiffEntry<Chunk>>,
}

pub fn compare_action_items(from_items: Vec<ActionItem>, to_items: Vec<ActionItem>) -> Vec<DiffEntry<ActionItem>> {
    let from_set: HashSet<_> = from_items.iter().cloned().collect();
    let to_set: to_items.iter().cloned().collect();

    let mut diff = Vec::new();

    for item in from_set.iter() {
        if !to_set.contains(item) {
            diff.push(DiffEntry {
                status: DiffStatus::Removed,
                item: item.clone(),
                modified_from: None,
                semantic_distance: None,
            });
        } else {
            diff.push(DiffEntry {
                status: DiffStatus::Unchanged,
                item: item.clone(),
                modified_from: None,
                semantic_distance: None,
            });
        }
    }

    for item in to_set.iter() {
        if !from_set.contains(item) {
            diff.push(DiffEntry {
                status: DiffStatus::Added,
                item: item.clone(),
                modified_from: None,
                semantic_distance: None,
            });
        }
    }
    
    diff
}

pub fn compare_chunks_semantic(from_chunks: Vec<Chunk>, to_chunks: Vec<Chunk>) -> Vec<DiffEntry<Chunk>> {
    let from_map: HashMap<_, _> = from_chunks.into_iter().map(|c| (c.position, c)).collect();
    let to_map: HashMap<_, _> = to_chunks.into_iter().map(|c| (c.position, c)).collect();
    let all_positions: HashSet<_> = from_map.keys().chain(to_map.keys()).collect();

    let mut diff = Vec::new();
    let mut sorted_positions: Vec<_> = all_positions.into_iter().collect();
    sorted_positions.sort();

    for pos in sorted_positions {
        match (from_map.get(pos), to_map.get(pos)) {
            (Some(from), Some(to)) => {
                if from.text_content == to.text_content {
                    diff.push(DiffEntry { status: DiffStatus::Unchanged, item: to.clone(), modified_from: None, semantic_distance: Some(0.0) });
                } else {
                    let distance = match (&from.embedding, &to.embedding) {
                        (Some(e1), Some(e2)) => Some(e1.dist(e2).unwrap_or(1.0)),
                        _ => None,
                    };
                    diff.push(DiffEntry { status: DiffStatus::Modified, item: to.clone(), modified_from: Some(from.clone()), semantic_distance: distance });
                }
            },
            (Some(from), None) => {
                diff.push(DiffEntry { status: DiffStatus::Removed, item: from.clone(), modified_from: None, semantic_distance: None });
            },
            (None, Some(to)) => {
                diff.push(DiffEntry { status: DiffStatus::Added, item: to.clone(), modified_from: None, semantic_distance: None });
            },
            (None, None) => (), // Should not happen
        }
    }

    diff
}
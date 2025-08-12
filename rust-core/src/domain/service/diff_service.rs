use serde::Serialize;
use std::collections::HashSet;
use std::hash::Hash;
use crate::domain::model::document::ActionItem; // Assumindo que ActionItem derive PartialEq, Eq, Hash e Clone

#[derive(Serialize, Debug, PartialEq)]
pub enum DiffStatus {
    Added,
    Removed,
    Unchanged,
}

#[derive(Serialize, Debug)]
pub struct DiffEntry<T> {
    pub status: DiffStatus,
    pub item: T,
}

#[derive(Serialize, Debug, Default)]
pub struct StructuralDiff {
    pub action_items_diff: Vec<DiffEntry<ActionItem>>,
    // Futuramente, podemos adicionar diffs para outros itens como tópicos, entidades, etc.
}

pub fn compare_action_items(from_items: Vec<ActionItem>, to_items: Vec<ActionItem>) -> Vec<DiffEntry<ActionItem>> {
    let from_set: HashSet<_> = from_items.iter().cloned().collect();
    let to_set: HashSet<_> = to_items.iter().cloned().collect();

    let mut diff = Vec::new();

    for item in from_set.iter() {
        if !to_set.contains(item) {
            diff.push(DiffEntry {
                status: DiffStatus::Removed,
                item: item.clone(),
            });
        } else {
            diff.push(DiffEntry {
                status: DiffStatus::Unchanged,
                item: item.clone(),
            });
        }
    }

    for item in to_set.iter() {
        if !from_set.contains(item) {
            diff.push(DiffEntry {
                status: DiffStatus::Added,
                item: item.clone(),
            });
        }
    }
    
    diff
}
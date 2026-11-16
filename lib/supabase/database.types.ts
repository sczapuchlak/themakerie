
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "crafts": {
                  Row: {
                    "name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"folders": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"name": string,"owner_id": string,"parent_id": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folder_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_materials": {
                  Row: {
                    "created_at": string,"description": string,"family": string,"id": string,"kind": string,"notes": string | null,"owner_id": string,"pattern_id": string,"position": number,"quantity_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"family"?: string,"id"?: string,"kind"?: string,"notes"?: string | null,"owner_id"?: string,"pattern_id": string,"position"?: number,"quantity_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"family"?: string,"id"?: string,"kind"?: string,"notes"?: string | null,"owner_id"?: string,"pattern_id"?: string,"position"?: number,"quantity_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_materials_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pattern_materials_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_sections": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"owner_id": string,"pattern_id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"pattern_id": string,"position"?: number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"pattern_id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_sections_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pattern_sections_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_sources": {
                  Row: {
                    "created_at": string,"file_name": string | null,"id": string,"kind": string,"metadata": NonNullable<Json>,"mime_type": string | null,"owner_id": string,"page_count": number | null,"pattern_id": string,"sha256": string | null,"size_bytes": number | null,"sort_order": number,"storage_path": string | null,"title": string | null,"url": string | null,"url_normalized": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name"?: string | null,"id"?: string,"kind": string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"owner_id"?: string,"page_count"?: number | null,"pattern_id": string,"sha256"?: string | null,"size_bytes"?: number | null,"sort_order"?: number,"storage_path"?: string | null,"title"?: string | null,"url"?: string | null,"url_normalized"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string | null,"id"?: string,"kind"?: string,"metadata"?: NonNullable<Json>,"mime_type"?: string | null,"owner_id"?: string,"page_count"?: number | null,"pattern_id"?: string,"sha256"?: string | null,"size_bytes"?: number | null,"sort_order"?: number,"storage_path"?: string | null,"title"?: string | null,"url"?: string | null,"url_normalized"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_sources_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pattern_sources_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_steps": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"owner_id": string,"position": number,"repeat_count": number | null,"row_end": number | null,"row_start": number | null,"section_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"repeat_count"?: number | null,"row_end"?: number | null,"row_start"?: number | null,"section_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"repeat_count"?: number | null,"row_end"?: number | null,"row_start"?: number | null,"section_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_steps_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "pattern_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"patterns": {
                  Row: {
                    "archived_at": string | null,"category": string | null,"cover_path": string | null,"craft": string,"craft_details": NonNullable<Json>,"created_at": string,"description": string | null,"designer": string | null,"difficulty": number | null,"dimensions": string | null,"favorite": boolean,"folder_id": string | null,"id": string,"materials": string | null,"notes": string | null,"owner_id": string,"search_text": string,"sizes": string | null,"source_name": string | null,"tags": (string)[],"techniques": (string)[],"title": string,"tools": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category"?: string | null,"cover_path"?: string | null,"craft": string,"craft_details"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"designer"?: string | null,"difficulty"?: number | null,"dimensions"?: string | null,"favorite"?: boolean,"folder_id"?: string | null,"id"?: string,"materials"?: string | null,"notes"?: string | null,"owner_id"?: string,"search_text"?: string,"sizes"?: string | null,"source_name"?: string | null,"tags"?: (string)[],"techniques"?: (string)[],"title": string,"tools"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: string | null,"cover_path"?: string | null,"craft"?: string,"craft_details"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"designer"?: string | null,"difficulty"?: number | null,"dimensions"?: string | null,"favorite"?: boolean,"folder_id"?: string | null,"id"?: string,"materials"?: string | null,"notes"?: string | null,"owner_id"?: string,"search_text"?: string,"sizes"?: string | null,"source_name"?: string | null,"tags"?: (string)[],"techniques"?: (string)[],"title"?: string,"tools"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patterns_craft_fkey"
      columns: ["craft"]
isOneToOne: false
      referencedRelation: "crafts"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "patterns_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folder_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patterns_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"project_bookmarks": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"owner_id": string,"page": number,"project_id": string,"source_id": string,"y": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"owner_id"?: string,"page": number,"project_id": string,"source_id": string,"y"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"owner_id"?: string,"page"?: number,"project_id"?: string,"source_id"?: string,"y"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_bookmarks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_bookmarks_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "pattern_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"project_counter_events": {
                  Row: {
                    "amount": number,"counter_id": string,"created_at": string,"id": string,"kind": string,"owner_id": string,"project_id": string,"rolled_over": boolean,"session_id": string | null,"value_after": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"counter_id": string,"created_at"?: string,"id": string,"kind": string,"owner_id"?: string,"project_id": string,"rolled_over"?: boolean,"session_id"?: string | null,"value_after"?: number | null
                  }
                  Update: {
                    "amount"?: number,"counter_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"project_id"?: string,"rolled_over"?: boolean,"session_id"?: string | null,"value_after"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_counter_events_counter_id_fkey"
      columns: ["counter_id"]
isOneToOne: false
      referencedRelation: "project_counters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_counter_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_counter_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "project_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_counters": {
                  Row: {
                    "client_updated_at": string,"created_at": string,"id": string,"is_main": boolean,"name": string,"owner_id": string,"position": number,"project_id": string,"rollover": boolean,"rollover_counter_id": string | null,"section_id": string | null,"step": number,"target": number | null,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_updated_at"?: string,"created_at"?: string,"id"?: string,"is_main"?: boolean,"name": string,"owner_id"?: string,"position"?: number,"project_id": string,"rollover"?: boolean,"rollover_counter_id"?: string | null,"section_id"?: string | null,"step"?: number,"target"?: number | null,"updated_at"?: string,"value"?: number
                  }
                  Update: {
                    "client_updated_at"?: string,"created_at"?: string,"id"?: string,"is_main"?: boolean,"name"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"rollover"?: boolean,"rollover_counter_id"?: string | null,"section_id"?: string | null,"step"?: number,"target"?: number | null,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_counters_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_counters_rollover_counter_id_fkey"
      columns: ["rollover_counter_id"]
isOneToOne: false
      referencedRelation: "project_counters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_counters_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "pattern_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"project_milestones": {
                  Row: {
                    "client_updated_at": string,"created_at": string,"done_at": string | null,"id": string,"owner_id": string,"position": number,"project_id": string,"session_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_updated_at"?: string,"created_at"?: string,"done_at"?: string | null,"id"?: string,"owner_id"?: string,"position"?: number,"project_id": string,"session_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "client_updated_at"?: string,"created_at"?: string,"done_at"?: string | null,"id"?: string,"owner_id"?: string,"position"?: number,"project_id"?: string,"session_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_milestones_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "project_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_notes": {
                  Row: {
                    "body": string,"client_updated_at": string,"created_at": string,"id": string,"kind": string,"owner_id": string,"pinned": boolean,"project_id": string,"session_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"client_updated_at"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"pinned"?: boolean,"project_id": string,"session_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"client_updated_at"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"pinned"?: boolean,"project_id"?: string,"session_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_notes_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_notes_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "project_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_photos": {
                  Row: {
                    "caption": string | null,"created_at": string,"file_name": string | null,"id": string,"mime_type": string | null,"owner_id": string,"project_id": string,"session_id": string | null,"show_in_gallery": boolean,"size_bytes": number | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"file_name"?: string | null,"id"?: string,"mime_type"?: string | null,"owner_id"?: string,"project_id": string,"session_id"?: string | null,"show_in_gallery"?: boolean,"size_bytes"?: number | null,"storage_path": string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"file_name"?: string | null,"id"?: string,"mime_type"?: string | null,"owner_id"?: string,"project_id"?: string,"session_id"?: string | null,"show_in_gallery"?: boolean,"size_bytes"?: number | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_photos_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_photos_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "project_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_progress_events": {
                  Row: {
                    "done": number | null,"id": string,"method": string,"note": string | null,"owner_id": string,"percent": number,"project_id": string,"recorded_at": string,"session_id": string | null,"target": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "done"?: number | null,"id"?: string,"method": string,"note"?: string | null,"owner_id"?: string,"percent": number,"project_id": string,"recorded_at"?: string,"session_id"?: string | null,"target"?: number | null
                  }
                  Update: {
                    "done"?: number | null,"id"?: string,"method"?: string,"note"?: string | null,"owner_id"?: string,"percent"?: number,"project_id"?: string,"recorded_at"?: string,"session_id"?: string | null,"target"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_progress_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_progress_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "project_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_reader_states": {
                  Row: {
                    "client_updated_at": string,"fit": string,"guides": NonNullable<Json>,"owner_id": string,"page": number,"project_id": string,"scroll_left": number,"scroll_top": number,"source_id": string,"updated_at": string,"zoom": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_updated_at"?: string,"fit"?: string,"guides"?: NonNullable<Json>,"owner_id"?: string,"page"?: number,"project_id": string,"scroll_left"?: number,"scroll_top"?: number,"source_id": string,"updated_at"?: string,"zoom"?: number
                  }
                  Update: {
                    "client_updated_at"?: string,"fit"?: string,"guides"?: NonNullable<Json>,"owner_id"?: string,"page"?: number,"project_id"?: string,"scroll_left"?: number,"scroll_top"?: number,"source_id"?: string,"updated_at"?: string,"zoom"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_reader_states_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_reader_states_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "pattern_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"project_sessions": {
                  Row: {
                    "accomplished": string | null,"active_seconds": number,"adjusted_seconds": number | null,"client_updated_at": string,"created_at": string,"duration_minutes": number | null,"duration_seconds": number | null,"ended_at": string | null,"id": string,"note": string | null,"owner_id": string,"progress_after": number | null,"progress_before": number | null,"project_id": string,"resumed_at": string | null,"started_at": string,"status": string,"units_after": number | null,"units_before": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accomplished"?: string | null,"active_seconds"?: number,"adjusted_seconds"?: number | null,"client_updated_at"?: string,"created_at"?: string,"duration_minutes"?: number | null,"duration_seconds"?: never,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"owner_id"?: string,"progress_after"?: number | null,"progress_before"?: number | null,"project_id": string,"resumed_at"?: string | null,"started_at"?: string,"status"?: string,"units_after"?: number | null,"units_before"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "accomplished"?: string | null,"active_seconds"?: number,"adjusted_seconds"?: number | null,"client_updated_at"?: string,"created_at"?: string,"duration_minutes"?: number | null,"duration_seconds"?: never,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"owner_id"?: string,"progress_after"?: number | null,"progress_before"?: number | null,"project_id"?: string,"resumed_at"?: string | null,"started_at"?: string,"status"?: string,"units_after"?: number | null,"units_before"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_sessions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_step_completions": {
                  Row: {
                    "completed_at": string,"owner_id": string,"project_id": string,"step_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"owner_id"?: string,"project_id": string,"step_id": string
                  }
                  Update: {
                    "completed_at"?: string,"owner_id"?: string,"project_id"?: string,"step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_step_completions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_step_completions_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "pattern_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "client_updated_at": string,"cover_path": string | null,"created_at": string,"finished_on": string | null,"id": string,"last_worked_at": string | null,"name": string,"notes": string | null,"owner_id": string,"pattern_id": string | null,"progress": number | null,"progress_counter_id": string | null,"progress_done": number,"progress_method": string,"progress_target": number | null,"size_colorway": string | null,"started_on": string | null,"status": string,"unit_label": string | null,"updated_at": string,"workspace": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "client_updated_at"?: string,"cover_path"?: string | null,"created_at"?: string,"finished_on"?: string | null,"id"?: string,"last_worked_at"?: string | null,"name": string,"notes"?: string | null,"owner_id"?: string,"pattern_id"?: string | null,"progress"?: number | null,"progress_counter_id"?: string | null,"progress_done"?: number,"progress_method"?: string,"progress_target"?: number | null,"size_colorway"?: string | null,"started_on"?: string | null,"status"?: string,"unit_label"?: string | null,"updated_at"?: string,"workspace"?: NonNullable<Json>
                  }
                  Update: {
                    "client_updated_at"?: string,"cover_path"?: string | null,"created_at"?: string,"finished_on"?: string | null,"id"?: string,"last_worked_at"?: string | null,"name"?: string,"notes"?: string | null,"owner_id"?: string,"pattern_id"?: string | null,"progress"?: number | null,"progress_counter_id"?: string | null,"progress_done"?: number,"progress_method"?: string,"progress_target"?: number | null,"size_colorway"?: string | null,"started_on"?: string | null,"status"?: string,"unit_label"?: string | null,"updated_at"?: string,"workspace"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_progress_counter_id_fkey"
      columns: ["progress_counter_id"]
isOneToOne: false
      referencedRelation: "project_counters"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_allocations": {
                  Row: {
                    "created_at": string,"holding_id": string | null,"id": string,"item_id": string,"kind": string,"measure": string | null,"note": string | null,"owner_id": string,"planned_quantity": number | null,"project_id": string,"requirement_id": string | null,"reserved_quantity": number,"status": string,"updated_at": string,"used_quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"holding_id"?: string | null,"id"?: string,"item_id": string,"kind": string,"measure"?: string | null,"note"?: string | null,"owner_id"?: string,"planned_quantity"?: number | null,"project_id": string,"requirement_id"?: string | null,"reserved_quantity"?: number,"status"?: string,"updated_at"?: string,"used_quantity"?: number
                  }
                  Update: {
                    "created_at"?: string,"holding_id"?: string | null,"id"?: string,"item_id"?: string,"kind"?: string,"measure"?: string | null,"note"?: string | null,"owner_id"?: string,"planned_quantity"?: number | null,"project_id"?: string,"requirement_id"?: string | null,"reserved_quantity"?: number,"status"?: string,"updated_at"?: string,"used_quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_allocations_holding_id_fkey"
      columns: ["holding_id"]
isOneToOne: false
      referencedRelation: "stash_holdings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_allocations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_allocations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_allocations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_allocations_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "pattern_materials"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_categories": {
                  Row: {
                    "created_at": string,"family": string,"id": string,"name": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family": string,"id"?: string,"name": string,"owner_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"family"?: string,"id"?: string,"name"?: string,"owner_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stash_collections": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"name": string,"owner_id": string,"parent_id": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_collections_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "stash_collections"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_holdings": {
                  Row: {
                    "amount_known": boolean,"condition": string,"created_at": string,"entry_unit": string,"height_mm": number | null,"id": string,"item_id": string,"label": string | null,"lot_id": string,"measure": string,"owner_id": string,"quantity": number,"reserved": number,"updated_at": string,"width_mm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_known"?: boolean,"condition"?: string,"created_at"?: string,"entry_unit"?: string,"height_mm"?: number | null,"id"?: string,"item_id": string,"label"?: string | null,"lot_id": string,"measure": string,"owner_id"?: string,"quantity"?: number,"reserved"?: number,"updated_at"?: string,"width_mm"?: number | null
                  }
                  Update: {
                    "amount_known"?: boolean,"condition"?: string,"created_at"?: string,"entry_unit"?: string,"height_mm"?: number | null,"id"?: string,"item_id"?: string,"label"?: string | null,"lot_id"?: string,"measure"?: string,"owner_id"?: string,"quantity"?: number,"reserved"?: number,"updated_at"?: string,"width_mm"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_holdings_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_holdings_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_holdings_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "stash_lots"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_items": {
                  Row: {
                    "archived_at": string | null,"brand": string | null,"category": string,"collection_id": string | null,"color_code": string | null,"color_families": (string)[],"color_hexes": (string)[],"color_name": string | null,"cover_path": string | null,"created_at": string,"family": string,"favorite": boolean,"id": string,"kind": string,"low_stock_threshold": number | null,"name": string,"notes": string | null,"owner_id": string,"product_line": string | null,"search_text": string,"specs": NonNullable<Json>,"tags": (string)[],"unit_label": string,"unit_length_cm": number | null,"unit_mass_dg": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"brand"?: string | null,"category": string,"collection_id"?: string | null,"color_code"?: string | null,"color_families"?: (string)[],"color_hexes"?: (string)[],"color_name"?: string | null,"cover_path"?: string | null,"created_at"?: string,"family": string,"favorite"?: boolean,"id"?: string,"kind": string,"low_stock_threshold"?: number | null,"name": string,"notes"?: string | null,"owner_id"?: string,"product_line"?: string | null,"search_text"?: string,"specs"?: NonNullable<Json>,"tags"?: (string)[],"unit_label"?: string,"unit_length_cm"?: number | null,"unit_mass_dg"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"brand"?: string | null,"category"?: string,"collection_id"?: string | null,"color_code"?: string | null,"color_families"?: (string)[],"color_hexes"?: (string)[],"color_name"?: string | null,"cover_path"?: string | null,"created_at"?: string,"family"?: string,"favorite"?: boolean,"id"?: string,"kind"?: string,"low_stock_threshold"?: number | null,"name"?: string,"notes"?: string | null,"owner_id"?: string,"product_line"?: string | null,"search_text"?: string,"specs"?: NonNullable<Json>,"tags"?: (string)[],"unit_label"?: string,"unit_length_cm"?: number | null,"unit_mass_dg"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "stash_collections"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_kit_items": {
                  Row: {
                    "created_at": string,"holding_id": string | null,"id": string,"item_id": string,"kit_id": string,"note": string | null,"owner_id": string,"quantity": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"holding_id"?: string | null,"id"?: string,"item_id": string,"kit_id": string,"note"?: string | null,"owner_id"?: string,"quantity"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"holding_id"?: string | null,"id"?: string,"item_id"?: string,"kit_id"?: string,"note"?: string | null,"owner_id"?: string,"quantity"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_kit_items_holding_id_fkey"
      columns: ["holding_id"]
isOneToOne: false
      referencedRelation: "stash_holdings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_kit_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_kit_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_kit_items_kit_id_fkey"
      columns: ["kit_id"]
isOneToOne: false
      referencedRelation: "stash_kits"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_kits": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"location_id": string | null,"name": string,"notes": string | null,"owner_id": string,"project_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"location_id"?: string | null,"name": string,"notes"?: string | null,"owner_id"?: string,"project_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"location_id"?: string | null,"name"?: string,"notes"?: string | null,"owner_id"?: string,"project_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_kits_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "stash_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_kits_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_locations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"notes": string | null,"owner_id": string,"parent_id": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"owner_id"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_locations_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "stash_locations"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_lots": {
                  Row: {
                    "condition": string | null,"created_at": string,"currency": string | null,"dye_lot": string | null,"id": string,"item_id": string,"location_id": string | null,"notes": string | null,"owner_id": string,"price_cents": number | null,"purchased_on": string | null,"source": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "condition"?: string | null,"created_at"?: string,"currency"?: string | null,"dye_lot"?: string | null,"id"?: string,"item_id": string,"location_id"?: string | null,"notes"?: string | null,"owner_id"?: string,"price_cents"?: number | null,"purchased_on"?: string | null,"source"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "condition"?: string | null,"created_at"?: string,"currency"?: string | null,"dye_lot"?: string | null,"id"?: string,"item_id"?: string,"location_id"?: string | null,"notes"?: string | null,"owner_id"?: string,"price_cents"?: number | null,"purchased_on"?: string | null,"source"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_lots_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_lots_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_lots_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "stash_locations"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_movements": {
                  Row: {
                    "allocation_id": string | null,"created_at": string,"delta_quantity": number,"delta_reserved": number,"holding_id": string | null,"id": string,"item_id": string,"kind": string,"measure": string | null,"note": string | null,"owner_id": string,"project_id": string | null,"quantity_after": number | null,"reserved_after": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_id"?: string | null,"created_at"?: string,"delta_quantity"?: number,"delta_reserved"?: number,"holding_id"?: string | null,"id": string,"item_id": string,"kind": string,"measure"?: string | null,"note"?: string | null,"owner_id"?: string,"project_id"?: string | null,"quantity_after"?: number | null,"reserved_after"?: number | null
                  }
                  Update: {
                    "allocation_id"?: string | null,"created_at"?: string,"delta_quantity"?: number,"delta_reserved"?: number,"holding_id"?: string | null,"id"?: string,"item_id"?: string,"kind"?: string,"measure"?: string | null,"note"?: string | null,"owner_id"?: string,"project_id"?: string | null,"quantity_after"?: number | null,"reserved_after"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_movements_holding_id_fkey"
      columns: ["holding_id"]
isOneToOne: false
      referencedRelation: "stash_holdings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_movements_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_photos": {
                  Row: {
                    "created_at": string,"file_name": string | null,"id": string,"item_id": string,"mime_type": string | null,"owner_id": string,"size_bytes": number | null,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name"?: string | null,"id"?: string,"item_id": string,"mime_type"?: string | null,"owner_id"?: string,"size_bytes"?: number | null,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string | null,"id"?: string,"item_id"?: string,"mime_type"?: string | null,"owner_id"?: string,"size_bytes"?: number | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_photos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_photos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_wants": {
                  Row: {
                    "brand": string | null,"color": string | null,"created_at": string,"currency": string | null,"family": string,"id": string,"item_id": string | null,"list": string,"merchant": string | null,"name": string,"needed_quantity": number | null,"notes": string | null,"owner_id": string,"price_cents": number | null,"priority": number,"project_id": string | null,"received_quantity": number,"size": string | null,"status": string,"unit_label": string | null,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"color"?: string | null,"created_at"?: string,"currency"?: string | null,"family"?: string,"id"?: string,"item_id"?: string | null,"list"?: string,"merchant"?: string | null,"name": string,"needed_quantity"?: number | null,"notes"?: string | null,"owner_id"?: string,"price_cents"?: number | null,"priority"?: number,"project_id"?: string | null,"received_quantity"?: number,"size"?: string | null,"status"?: string,"unit_label"?: string | null,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"color"?: string | null,"created_at"?: string,"currency"?: string | null,"family"?: string,"id"?: string,"item_id"?: string | null,"list"?: string,"merchant"?: string | null,"name"?: string,"needed_quantity"?: number | null,"notes"?: string | null,"owner_id"?: string,"price_cents"?: number | null,"priority"?: number,"project_id"?: string | null,"received_quantity"?: number,"size"?: string | null,"status"?: string,"unit_label"?: string | null,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stash_wants_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_item_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_wants_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "stash_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stash_wants_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "folder_overview": {
                  Row: {
                    "child_count": number | null,"color": string | null,"created_at": string,"direct_pattern_count": number | null,"id": string,"name": string,"owner_id": string,"parent_id": string | null,"pattern_count": number | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folder_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_overview": {
                  Row: {
                    "active_count": number | null,"archived_at": string | null,"category": string | null,"cover_path": string | null,"craft": string,"craft_details": NonNullable<Json>,"created_at": string,"description": string | null,"designer": string | null,"difficulty": number | null,"dimensions": string | null,"favorite": boolean,"finished_count": number | null,"folder_id": string | null,"has_sources": boolean | null,"id": string,"last_worked_at": string | null,"materials": string | null,"notes": string | null,"owner_id": string,"project_count": number | null,"search_text": string,"sizes": string | null,"source_kinds": (string)[] | null,"source_name": string | null,"tags": (string)[],"techniques": (string)[],"title": string,"tools": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "patterns_craft_fkey"
      columns: ["craft"]
isOneToOne: false
      referencedRelation: "crafts"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "patterns_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folder_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patterns_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"stash_item_overview": {
                  Row: {
                    "active_allocations": number | null,"archived_at": string | null,"brand": string | null,"category": string,"collection_id": string | null,"color_code": string | null,"color_families": (string)[],"color_hexes": (string)[],"color_name": string | null,"cover_path": string | null,"created_at": string,"family": string,"favorite": boolean,"full_units": number | null,"has_unknown_partials": boolean | null,"id": string,"kind": string,"location_ids": (string)[] | null,"loose_length_cm": number | null,"loose_mass_dg": number | null,"lot_count": number | null,"low_stock_threshold": number | null,"name": string,"notes": string | null,"owner_id": string,"partial_units": number | null,"pieces": number | null,"product_line": string | null,"quantity_total": number | null,"reserved_total": number | null,"reserved_units": number | null,"search_text": string,"specs": NonNullable<Json>,"tags": (string)[],"unit_label": string,"unit_length_cm": number | null,"unit_mass_dg": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stash_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "stash_collections"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_counter_event":
{ Args: { "p_amount": number,"p_at"?: string,"p_counter": string,"p_id": string,"p_kind": string,"p_session"?: string }; Returns: {
              "r_applied": boolean,"r_counter": string,"r_rolled": number,"r_value": number
            }[]
                           },
"delete_folder":
{ Args: { "target": string }; Returns: undefined
                           },
"is_authorized_account":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_owner":
{ Args: { "owner": string }; Returns: boolean
                           },
"stash_change":
{ Args: { "p_delta": number,"p_holding": string,"p_id": string,"p_kind": string,"p_note"?: string }; Returns: {
              "r_applied": boolean,"r_quantity": number,"r_reserved": number
            }[]
                           },
"stash_reserve":
{ Args: { "p_allocation": string,"p_delta": number,"p_id": string }; Returns: {
              "r_applied": boolean,"r_available": number,"r_reserved": number
            }[]
                           },
"stash_return_leftover":
{ Args: { "p_allocation": string,"p_amount": number,"p_amount_known"?: boolean,"p_id": string,"p_measure": string,"p_note"?: string }; Returns: string
                           },
"stash_use":
{ Args: { "p_allocation": string,"p_amount": number,"p_id": string,"p_note"?: string }; Returns: {
              "r_applied": boolean,"r_quantity": number,"r_reserved": number,"r_used": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

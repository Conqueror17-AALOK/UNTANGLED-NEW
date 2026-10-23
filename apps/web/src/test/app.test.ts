import { describe, it, expect } from 'vitest';
import { apiClient } from '../api/client';
import { PIPELINE_STAGES } from '../api/ws';

describe('Frontend API and Pipeline Stages', () => {
  it('should have 9 deterministic pipeline stages defined', () => {
    expect(PIPELINE_STAGES).toHaveLength(9);
    expect(PIPELINE_STAGES[0].id).toBe('perception');
    expect(PIPELINE_STAGES[8].id).toBe('report');
  });

  it('should retrieve mock tags in standalone demo mode', async () => {
    const tags = await apiClient.getTags('demo-job-1');
    expect(tags.length).toBeGreaterThan(0);
    const ptTag = tags.find((t) => t.raw_text === 'PT10l');
    expect(ptTag).toBeDefined();
    expect(ptTag?.status).toBe('needs_review');
  });

  it('should update a tag and mark it as human verified', async () => {
    const updated = await apiClient.updateTag('demo-job-1', 'tag_0004', 'PT-101');
    expect(updated.normalized_tag).toBe('PT-101');
    expect(updated.confidence).toBe(1.0);
    expect(updated.source).toBe('human');
  });
});

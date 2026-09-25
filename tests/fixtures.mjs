// Hand-authored fixture following the publicly observed person-history shape.
export function historyPayload(id = 7) {
  return {
    staff: { id, ja: '\u62bc\u5c71\u6e05\u9ad8', en: `Person ${id}`, aliases: [
      { en: `Person ${id}`, jaAliases: [{ ja: '\u62bc\u5c71\u6e05\u9ad8', count: 2 }], count: 2 },
      { en: 'Alias A', jaAliases: [], count: 1 },
    ] },
    jobs: ['Key Animator'], studios: {},
    credits: [{ uuid: 'prod', slug: 'show', stafflist_name: 'Show', stafflist_name_ja: '\u30b7\u30e7\u30fc',
      seasonYear: 2025, stafflist_studios: 'Studio A, Studio B', names: [{ en: 'Alias A', ja: '', categories: [
        { category: 'Key Animation', roles: [{ role_ja: '\u539f\u753b', role_en: 'Key Animation', credits: [
          { episode: '#001', is_nc: 1, comment: 'First credit', studio: { en: 'Studio A', ja: '' }, is_primary_alias: false },
          { episode: 'Overview', is_nc: 0, comment: null, studio: null, is_primary_alias: true },
        ] }] },
      ] }] }],
  };
}

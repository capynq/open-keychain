export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Dependabot bodies contain long release-note URLs; keep header/subject
    // validation while allowing those generated descriptions through CI.
    'body-max-line-length': [0, 'always', 100],
  },
};

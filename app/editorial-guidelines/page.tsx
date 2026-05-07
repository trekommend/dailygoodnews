export default function EditorialGuidelinesPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 40 }}>
      <h1>Editorial Guidelines</h1>

      <p style={{ fontSize: 18, lineHeight: 1.8 }}>
        Daily Good News publishes uplifting, constructive, and hopeful stories
        from trusted sources and reader submissions.
      </p>

      <h2>What we look for</h2>
      <ul style={{ fontSize: 18, lineHeight: 1.8 }}>
        <li>Stories about kindness, community, hope, animals, health, or helpful action.</li>
        <li>Original reader stories written in your own words.</li>
        <li>Links to positive articles from real publications.</li>
        <li>Optional YouTube or Vimeo videos that support the story.</li>
      </ul>

      <h2>What we do not publish</h2>
      <ul style={{ fontSize: 18, lineHeight: 1.8 }}>
        <li>Spam, scams, hate, harassment, or graphic content.</li>
        <li>Unverified claims presented as facts.</li>
        <li>Copied articles submitted as original writing.</li>
        <li>Unsafe links or links from blocked domains.</li>
      </ul>

      <h2>Review process</h2>
      <p style={{ fontSize: 18, lineHeight: 1.8 }}>
        Submissions are reviewed before publication. Submission does not
        guarantee publication, and Daily Good News may edit titles, summaries,
        categories, formatting, or attribution for clarity and safety.
      </p>
    </main>
  );
}
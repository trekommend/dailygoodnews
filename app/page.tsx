import { supabase } from "../lib/supabase";
import Link from "next/link";

type Story = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  image_url: string | null;
  source_name: string;
  publish_date: string;
  category_slug: string;
  story_score: number | null;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRecentCutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function categoryLabel(category: string) {
  switch (category) {
    case "health":
      return "Health";
    case "community":
      return "Community";
    case "kindness":
      return "Kindness";
    case "animals":
      return "Animals";
    case "hope":
    default:
      return "Hope";
  }
}

function categoryClasses(category: string) {
  switch (category) {
    case "health":
      return "bg-green-100 text-green-800";
    case "community":
      return "bg-blue-100 text-blue-800";
    case "kindness":
      return "bg-pink-100 text-pink-800";
    case "animals":
      return "bg-amber-100 text-amber-800";
    case "hope":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

export default async function HomePage() {
  const recentCutoff = getRecentCutoffIso(2);

  const { data: recentFeaturedCandidates, error: recentError } = await supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, source_name, publish_date, category_slug, story_score"
    )
    .gte("publish_date", recentCutoff)
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(1);

  if (recentError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-4 text-4xl font-bold">Daily Good News</h1>
        <p>Could not load stories.</p>
      </main>
    );
  }

  let featuredStory = recentFeaturedCandidates?.[0] ?? null;

  if (!featuredStory) {
    const { data: fallbackFeatured, error: fallbackError } = await supabase
      .from("stories")
      .select(
        "id, title, slug, summary, image_url, source_name, publish_date, category_slug, story_score"
      )
      .order("story_score", { ascending: false, nullsFirst: false })
      .order("publish_date", { ascending: false })
      .limit(1);

    if (fallbackError) {
      return (
        <main className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="mb-4 text-4xl font-bold">Daily Good News</h1>
          <p>Could not load stories.</p>
        </main>
      );
    }

    featuredStory = fallbackFeatured?.[0] ?? null;
  }

  const { data: stories, error } = await supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, source_name, publish_date, category_slug, story_score"
    )
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(25);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-4 text-4xl font-bold">Daily Good News</h1>
        <p>Could not load stories.</p>
      </main>
    );
  }

  const remainingStories =
    stories?.filter((story: Story) => story.id !== featuredStory?.id) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Daily Good News</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Uplifting stories from health, science, kindness, community, and hope.
        </p>
      </header>

      {featuredStory && (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Top good news</h2>
            <span className="text-sm text-gray-500">Featured story</span>
          </div>

          <Link href={`/stories/${featuredStory.slug}`} className="block group">
            <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
              {featuredStory.image_url ? (
                <img
                  src={featuredStory.image_url}
                  alt={featuredStory.title}
                  className="h-[380px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[380px] w-full items-center justify-center bg-gray-100 text-gray-400">
                  No image available
                </div>
              )}

              <div className="p-6 md:p-8">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-3 py-1 font-medium ${categoryClasses(
                      featuredStory.category_slug
                    )}`}
                  >
                    {categoryLabel(featuredStory.category_slug)}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{featuredStory.source_name}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">
                    {formatDate(featuredStory.publish_date)}
                  </span>
                </div>

                <h3 className="text-3xl font-semibold leading-tight group-hover:underline">
                  {featuredStory.title}
                </h3>

                <p className="mt-4 max-w-3xl text-lg text-gray-700 line-clamp-4">
                  {featuredStory.summary}
                </p>

                <p className="mt-6 text-sm font-medium text-gray-900">
                  Read full story →
                </p>
              </div>
            </article>
          </Link>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Latest uplifting stories</h2>
          <span className="text-sm text-gray-500">
            Ranked by positivity and freshness
          </span>
        </div>

        {remainingStories.length === 0 ? (
          <p className="text-gray-600">No stories found yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {remainingStories.map((story: Story) => (
              <Link
                key={story.id}
                href={`/stories/${story.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {story.image_url ? (
                  <img
                    src={story.image_url}
                    alt={story.title}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 w-full items-center justify-center bg-gray-100 text-gray-400">
                    No image
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 font-medium ${categoryClasses(
                        story.category_slug
                      )}`}
                    >
                      {categoryLabel(story.category_slug)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">{story.source_name}</span>
                  </div>

                  <h3 className="text-xl font-semibold leading-snug group-hover:underline">
                    {story.title}
                  </h3>

                  <p className="mt-3 text-sm text-gray-700 line-clamp-3">
                    {story.summary}
                  </p>

                  <p className="mt-4 text-sm text-gray-500">
                    {formatDate(story.publish_date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
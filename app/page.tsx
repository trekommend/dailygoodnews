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
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

export default async function HomePage() {
  const recentCutoff = getRecentCutoffIso(2);

  const selectFields =
    "id, title, slug, summary, image_url, source_name, publish_date, category_slug, story_score";

  const { data: recentFeaturedCandidates } = await supabase
    .from("stories")
    .select(selectFields)
    .gte("publish_date", recentCutoff)
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(1);

  let featuredStory = recentFeaturedCandidates?.[0] ?? null;

  if (!featuredStory) {
    const { data: fallbackFeatured } = await supabase
      .from("stories")
      .select(selectFields)
      .order("story_score", { ascending: false, nullsFirst: false })
      .order("publish_date", { ascending: false })
      .limit(1);

    featuredStory = fallbackFeatured?.[0] ?? null;
  }

  const { data: stories, error } = await supabase
    .from("stories")
    .select(selectFields)
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(25);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-4xl font-bold">Daily Good News</h1>
        <p>Could not load stories.</p>
      </main>
    );
  }

  const remainingStories =
    stories?.filter((story: Story) => story.id !== featuredStory?.id) ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Daily Good News</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Uplifting stories from health, science, kindness, community, and hope.
        </p>
      </header>

      {featuredStory && (
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">Top good news</h2>
            <span className="text-sm text-gray-500">Featured story</span>
          </div>

          <Link href={`/stories/${featuredStory.slug}`} className="block">
            <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
              {featuredStory.image_url ? (
                <img
                  src={featuredStory.image_url}
                  alt={featuredStory.title}
                  className="block h-36 w-full object-cover sm:h-44"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-gray-100 text-gray-400 sm:h-44">
                  No image available
                </div>
              )}

              <div className="p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
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

                <h3 className="text-2xl font-semibold leading-tight text-gray-900 hover:underline">
                  {featuredStory.title}
                </h3>

                <p className="mt-3 line-clamp-3 text-base text-gray-700">
                  {featuredStory.summary}
                </p>

                <p className="mt-4 text-sm font-medium text-gray-900">
                  Read full story →
                </p>
              </div>
            </article>
          </Link>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Latest uplifting stories</h2>
          <span className="text-sm text-gray-500">Ranked by positivity and freshness</span>
        </div>

        {remainingStories.length === 0 ? (
          <p className="text-gray-600">No stories found yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {remainingStories.map((story: Story) => (
              <Link key={story.id} href={`/stories/${story.slug}`} className="block">
                <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                  {story.image_url ? (
                    <img
                      src={story.image_url}
                      alt={story.title}
                      className="block h-24 w-full object-cover sm:h-28"
                    />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-gray-100 text-gray-400 sm:h-28">
                      No image
                    </div>
                  )}

                  <div className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
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

                    <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-gray-900 hover:underline">
                      {story.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                      {story.summary}
                    </p>

                    <p className="mt-3 text-sm text-gray-500">
                      {formatDate(story.publish_date)}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
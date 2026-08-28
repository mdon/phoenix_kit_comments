import Config

config :logger, level: :warning

# Integration tests run against a real PostgreSQL database. Create it with:
#   createdb phoenix_kit_comments_test
config :phoenix_kit_comments, ecto_repos: [PhoenixKitComments.Test.Repo]

# `PGDATABASE` lets this suite point at a database the test role isn't
# allowed to CREATE (e.g. a shared instance) instead of the name Hex CI
# provisions for itself. Same mechanism as core phoenix_kit's
# config/test.exs — see there for the full rationale. Left unset (CI's
# case), this falls back to the previous hardcoded name, so publishing
# and CI are unaffected.
pg_test_db =
  case System.get_env("PGDATABASE") do
    value when is_binary(value) and value != "" -> String.trim(value)
    _ -> "phoenix_kit_comments_test#{System.get_env("MIX_TEST_PARTITION")}"
  end

# `PGPOOL` bounds the connection pool the same way core does — the default
# (`schedulers_online() * 2`) opens dozens of connections on a many-core
# box, which is fine against a private local Postgres but not against a
# shared instance already near its connection ceiling.
pg_test_pool =
  case System.get_env("PGPOOL") do
    value when is_binary(value) and value != "" ->
      case Integer.parse(String.trim(value)) do
        {size, ""} when size > 0 -> size
        _ -> raise "PGPOOL must be a positive integer, got: #{inspect(value)}"
      end

    _ ->
      System.schedulers_online() * 2
  end

config :phoenix_kit_comments, PhoenixKitComments.Test.Repo,
  username: System.get_env("PGUSER", "postgres"),
  password: System.get_env("PGPASSWORD", "postgres"),
  hostname: System.get_env("PGHOST", "localhost"),
  database: pg_test_db,
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: pg_test_pool

# `PhoenixKit.RepoHelper` resolves this — without it every context-layer DB
# call in the module falls into its own rescue and returns a plausible
# nothing, which is exactly how several tests came to assert the rescue.
config :phoenix_kit, repo: PhoenixKitComments.Test.Repo

# Endpoint for the LiveView test suite (test/support/test_endpoint.ex). The
# module is a library and borrows the host's endpoint in production; this one
# exists so `Phoenix.LiveViewTest` can drive the admin LiveViews.
config :phoenix_kit_comments, PhoenixKitComments.Test.Endpoint,
  url: [host: "localhost"],
  secret_key_base: String.duplicate("a", 64),
  render_errors: [
    formats: [html: PhoenixKitComments.Test.Layouts],
    layout: false
  ],
  pubsub_server: PhoenixKit.PubSub,
  live_view: [signing_salt: "comments-test-salt"],
  server: false

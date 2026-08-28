defmodule PhoenixKitComments.Test.Endpoint do
  @moduledoc """
  Minimal Phoenix.Endpoint for the LiveView test suite.

  `phoenix_kit_comments` is a library — in production it borrows the host
  app's endpoint and router. Tests spin up a tiny endpoint + router
  (`PhoenixKitComments.Test.Router`) so `Phoenix.LiveViewTest` can drive the
  moderation and settings LiveViews through `live/2` with real URLs.
  """

  use Phoenix.Endpoint, otp_app: :phoenix_kit_comments

  @session_options [
    store: :cookie,
    key: "_phoenix_kit_comments_test_key",
    signing_salt: "comments-test-salt",
    same_site: "Lax"
  ]

  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]])

  plug(Plug.Session, @session_options)
  plug(PhoenixKitComments.Test.Router)
end

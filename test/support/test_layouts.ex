defmodule PhoenixKitComments.Test.Layouts do
  @moduledoc """
  Minimal layouts for the LiveView test endpoint. The real ones live in the
  host app and in core — these just wrap content in an HTML shell.

  `app/1` renders flashes with stable ids, because without that a
  `put_flash` is silently swallowed and assertions fall back to
  "process is still alive" tautologies.
  """

  use Phoenix.Component

  def root(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="csrf-token" content={Phoenix.Controller.get_csrf_token()} />
        <title>Test</title>
      </head>
      <body>
        {@inner_content}
      </body>
    </html>
    """
  end

  def app(assigns) do
    ~H"""
    <div id="test-flashes">
      <div :if={msg = Phoenix.Flash.get(@flash, :info)} id="flash-info">{msg}</div>
      <div :if={msg = Phoenix.Flash.get(@flash, :error)} id="flash-error">{msg}</div>
      <div :if={msg = Phoenix.Flash.get(@flash, :warning)} id="flash-warning">{msg}</div>
    </div>
    {@inner_content}
    """
  end

  # Phoenix's error pipeline renders "<status>.html" from the layouts module
  # when a LiveView raises during mount. Forward everything here so a test
  # gets a readable error rather than "no template defined".
  def render(_template, assigns) do
    ~H"""
    <html>
      <body>
        <h1>Error</h1>
        <pre>{inspect(assigns[:reason] || assigns[:conn])}</pre>
      </body>
    </html>
    """
  end
end

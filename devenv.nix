{
  pkgs,
  ...
}:

{
  packages = with pkgs; [
    git
    claude-code
  ];

  languages = {
    javascript = {
      enable = true;
      npm.enable = true;
      pnpm.enable = true;
      yarn.enable = true;
    };

    typescript.enable = true;
  };
}

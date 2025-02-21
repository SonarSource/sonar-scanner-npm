load("cirrus", "env")
load("github.com/SonarSource/cirrus-modules@v3", "load_features")

def main(ctx):
  result = load_features(ctx, ["aws", "vault"])
  resultEnv = result.get("env")
  
  branchName = env.get("CIRRUS_BRANCH")
  slug = branchName.replace("/", "--")
  
  tagName = env.get("CIRRUS_TAG")
  
  if tagName != "":
    version = tagName
  else:
    branchName = env.get("CIRRUS_BRANCH")
    slug = branchName.replace("/", "--")
    version = slug
  
  resultEnv.update({
    "VERSION": version
  })
  
  result.update({"env": resultEnv})
  
  return result

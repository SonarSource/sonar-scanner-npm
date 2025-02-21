load("cirrus", "env")
load("github.com/SonarSource/cirrus-modules@v3", "load_features")

def main(ctx):
  result = load_features(ctx, ["aws", "vault"])
  resultEnv = result.get("env")
  
  tagName = env.get("CIRRUS_TAG")
  
  if tagName:
    version = tagName
  else:
    version = env.get("CIRRUS_BRANCH").replace("/", "--")
  
  resultEnv.update({
    "VERSION": version
  })
  
  result.update({"env": resultEnv})
  
  return result

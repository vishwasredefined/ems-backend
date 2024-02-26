const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth2').Strategy;

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: `${process.env.GOOGLE_CLIENT_ID}`,
  clientSecret: `${process.env.GOOGLE_CLIENT_SECRET}`,
  callbackURL: "http://localhost:3000/auth/v1/google/callback",
  passReqToCallback: true
},
  function (request, accessToken, refreshToken, profile, done) {
    console.log("accessToken", accessToken);
    console.log("refreshToken", refreshToken);
    console.log("profile", profile);

    let data = {
      profile: profile,
      accessToken: accessToken,
      refreshToken: refreshToken
    }

    passport.serializeUser(function (data, done) {
      done(null, data);
    }),

      passport.deserializeUser(function (data, done) {
        done(null, data);
      })
    return done(null, data);
  }
));
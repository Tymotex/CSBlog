const express = require("express"),
      router = express.Router(),
      passport = require("passport"),
      moment = require("moment"),
      Blog = require("../models/blog"),
      Comment = require("../models/comment"),
      User = require("../models/user");

// ===== Middleware Helper Functions =====
// Note that route handlers app.get, app.post, etc. can be given multiple callback functions
// that behave like middleware to handle a request

// Checks if a user is authenticated
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect("/login");
    }
}

// Checks if the user is authorised, ie. that their _id is the same as the _id of the author
// of the blog. This prevents users from editing/deleting blogs that they didn't write 
function checkBlogOwnership(req, res, next) {
    Blog.findById(req.params.blogID, function(err, foundBlog) {
        if (err) {
            console.log(err);
        } else {
            // Can't directly use '==' to compare IDs because req.user._id is a string and
            // foundBlog.author.id is a Mongoose ObjectID
            if (foundBlog.author.id.equals(req.user._id)) {
                // User is authorised to make changes to this blog
                // Calling next to proceed with the next operation along the middleware stack
                next();
            } else {
                res.redirect("back");
            }
        }
    });
}

// RESTful Routes: |  Index |  New  |  Create  |  Show  |  Edit  |  Update  |  Destroy  | 
//                 |   GET  |  GET  |   POST   |  GET   |  GET   |   PUT    |   DELETE  |
// ===== RESTful Blog Index (GET) =====
router.get("/", function(req, res) {
    console.log("Attempting to view all blogs");
    Blog.find({}, function(err, searchResults) {
        if (err) {
            console.log(err);
        } else {
            res.render("blogs/blogsIndex", {
                blogs: searchResults,
                moment: moment
            });
        }
    });
});

// ===== RESTful Blog New (GET) =====
// 'New' shows the form for creating a new blog
router.get("/new", isLoggedIn, function(req, res) {
    res.render("blogs/blogsNew");
});

// ===== RESTful Blog Create (POST) ===== 
// Create a new blog document from submitted form data (accessed in req.body)
// thanks to 'body-parser' 
router.post("/", isLoggedIn, function(req, res) {
    // 'express-sanitizer' filters out malicious raw code in the newly created blog
    req.body.blog.content = req.sanitize(req.body.blog.content);
    Blog.create({
        title: req.body.blog.title,
        author: {
            id: req.user._id,
            username: req.user.username
        },
        image: req.body.blog.image,
        content: req.body.blog.content
    }, function(err, newBlogPost) {
        if (err) {
            console.log(err);
        } else {
            console.log(newBlogPost);
        }
    });
    res.redirect("/blogs");
});

// ===== RESTful Blog Show (GET) ===== 
// Display details about one specific blog, identified by blogID
router.get("/:blogID", function(req, res) {
    // The populate() method lets you reference documents in other collections
    // This replaces specified paths in the Blog document with comment documents
    Blog.findById({_id: req.params.blogID}).populate("comments").exec(function(err, foundBlog) {
        if (err) {
            res.send("Error");
        } else {
            console.log(foundBlog);
            res.render("blogs/blogsView", {
                blog: foundBlog,
                moment: moment
            });
        }
    });
});

// ===== RESTful Blog Edit (GET) =====
// Show an edit form for a specific blog document identified by blogID
router.get("/:blogID/edit", isLoggedIn, checkBlogOwnership, function(req, res) {
    // The existing blog must be retrieved so that the edit form shows the
    // current data
    Blog.findById(req.params.blogID, function(err, foundBlog) {
        if (err) {
            res.send("Error");
        } else {
            res.render("blogs/blogsEdit", {
                blog: foundBlog
            });
        }
    });
});

// ===== RESTful Blog Update (PUT) =====
// Update the blog document in the database with the submitted modifications 
router.put("/:blogID", isLoggedIn, checkBlogOwnership, function(req, res) {
    req.body.blog.content = req.sanitize(req.body.blog.content);
    // req.body.blog is an object containing the modified fields: title, image, content
    Blog.findByIdAndUpdate(req.params.blogID, req.body.blog, function(err, updatedBlog) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/blogs/" + req.params.blogID);
        }
    });
});

// ===== RESTful Blog Destroy (DELETE) =====
// Delete a specific blog document from the database, identified by blogID
router.delete("/:blogID", isLoggedIn, checkBlogOwnership, function(req, res) {
    Blog.findByIdAndRemove(req.params.blogID, function(err, removedBlog) {
        if (err) {
            console.log(err);
        } else {
            // Also delete all comments attached to the blog
            Comment.deleteMany({_id: {$in: removedBlog.comments}}, function(err, deletedComments) {
                if (err) {
                    console.log(err);
                }
                console.log("===== Deleted Comments Summary =====")
                console.log(deletedComments);
                res.redirect("/blogs");
            })
        }
    });
});

module.exports = router;